import type { Customer, Order } from '../types/index.ts';
import { removeVietnameseTones } from './vietnamese.ts';
import { normalizeSinglePhone, normalizeVietnamesePhone, isPhoneMatching } from './excel.ts';
import { segmentFusedPhone } from './phoneRecovery.ts';
import {
  extractIndividualAddresses,
  getAllCustomerAddresses,
  normalizeAddressList,
  convertAddressToExtraAddresses,
  isAddressMatching,
} from './addressUtils.ts';

export { extractIndividualAddresses, convertAddressToExtraAddresses };

export interface ToneTwinGroup {
  toneCleanName: string;
  customers: Customer[];
}

export interface MultiPhoneAnomaly {
  customer: Customer;
  phones: string[];
}

export interface MultiAddressAnomaly {
  customer: Customer;
  addresses: string[];
}

export interface DuplicatePhoneGroup {
  normalizedPhone: string;
  customers: Customer[];
}

export interface CustomerOrderDiscrepancy {
  customer: Customer;
  historicalOrders: Order[];
  differingPhones: string[];
  differingAddresses: string[];
  differingNames: string[];
}

export interface CustomerAnomalyAuditResult {
  totalAnomalies: number;
  toneTwins: ToneTwinGroup[];
  multiPhoneAnomalies: MultiPhoneAnomaly[];
  multiAddressAnomalies: MultiAddressAnomaly[];
  duplicatePhoneGroups: DuplicatePhoneGroup[];
  orderDiscrepancies: CustomerOrderDiscrepancy[];
}

export interface MigrationRepairResult {
  repairedCustomers: Customer[];
  repairedOrders: Order[];
  changesCount: number;
  log: string[];
}

/**
 * Check if customer name is a generic placeholder (e.g. Khách lẻ tại quầy, Khách lẻ vãng lai)
 */
export function isGenericCustomerName(name: string): boolean {
  if (!name) return true;
  const clean = removeVietnameseTones(name).trim();
  return clean === '' || clean.includes('khach le') || clean.includes('vang lai');
}

/**
 * Find other customers sharing the same unaccented name or base tokens (Tone Twins).
 * Excludes generic customer records.
 */
export function findToneTwinCustomers(
  selectedCustomer: Customer,
  allCustomers: Customer[]
): Customer[] {
  if (!selectedCustomer || !selectedCustomer.name) return [];
  if (isGenericCustomerName(selectedCustomer.name)) return [];

  const targetClean = removeVietnameseTones(selectedCustomer.name).trim();
  if (!targetClean) return [];

  return allCustomers.filter(c => {
    if (c.id === selectedCustomer.id) return false;
    if (isGenericCustomerName(c.name)) return false;
    const cClean = removeVietnameseTones(c.name).trim();
    return cClean === targetClean;
  });
}

/**
 * Extract distinct phone numbers from a customer phone field (or both phone and phone2).
 */
export function extractIndividualPhones(phoneStr: string, phone2Str?: string): string[] {
  const combined = [phoneStr, phone2Str].filter(Boolean).join(' / ');
  if (!combined) return [];
  const parts = combined
    .split(/[\/,;\n\r|]|\s+-\s+/)
    .map(p => p.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const part of parts) {
    // Check if part has multiple numbers run together or space-separated
    const subParts = part.match(/(?:\+84|0|\b)[0-9]{9,11}\b/g);
    if (subParts && subParts.length > 1) {
      for (const sp of subParts) {
        const norm = normalizeSinglePhone(sp);
        if (norm && !result.includes(norm)) result.push(norm);
      }
    } else {
      const norm = normalizeSinglePhone(part);
      if (norm) {
        if (norm.length > 11) {
          const segmented = segmentFusedPhone(norm);
          if (segmented && segmented.length > 0) {
            for (const sp of segmented) {
              if (!result.includes(sp)) result.push(sp);
            }
          } else if (!result.includes(norm)) {
            result.push(norm);
          }
        } else if (!result.includes(norm)) {
          result.push(norm);
        }
      }
    }
  }
  return result;
}

/**
 * Perform a comprehensive audit on customer records for all anomalies:
 * 1. Tone Twins (name collisions with different diacritics)
 * 2. Multi-phone anomalies (concatenated or delimited phones)
 * 3. Multi-address anomalies (slashed or delimited addresses)
 * 4. Duplicate phone numbers across different customer records
 * 5. Historical Order Discrepancies (customer profile phone/address/name overwritten compared to past orders)
 */
export function auditCustomerData(
  customers: Customer[],
  orders: Order[] = []
): CustomerAnomalyAuditResult {
  const toneMap = new Map<string, Customer[]>();
  const multiPhoneAnomalies: MultiPhoneAnomaly[] = [];
  const multiAddressAnomalies: MultiAddressAnomaly[] = [];
  const phoneMap = new Map<string, Customer[]>();
  const orderDiscrepancies: CustomerOrderDiscrepancy[] = [];

  for (const c of customers) {
    // 1. Group for Tone Twins (excluding generic names)
    if (!isGenericCustomerName(c.name)) {
      const cleanName = removeVietnameseTones(c.name).trim();
      if (cleanName) {
        const group = toneMap.get(cleanName) || [];
        group.push(c);
        toneMap.set(cleanName, group);
      }
    }

    // 2. Check Multi-Phone Anomalies (ADR-0017 & ADR-0019)
    // When auditing a customer who has clean separate phone and phone2, do NOT flag them as an anomaly if both are valid numbers
    const p1List = extractIndividualPhones(c.phone || '');
    const p2List = c.phone2 ? extractIndividualPhones(c.phone2) : [];

    const isP1Anomaly =
      p1List.length > 1 ||
      Boolean(c.phone && (c.phone.includes('/') || c.phone.replace(/\D/g, '').length > 11));
    const isP2Anomaly =
      p2List.length > 1 ||
      Boolean(c.phone2 && (c.phone2.includes('/') || c.phone2.replace(/\D/g, '').length > 11));

    if (isP1Anomaly || isP2Anomaly) {
      const allExtracted = extractIndividualPhones(c.phone || '', c.phone2);
      multiPhoneAnomalies.push({
        customer: c,
        phones: allExtracted.length > 0 ? allExtracted : [c.phone, c.phone2].filter(Boolean) as string[],
      });
    }

    // 3. Check Multi-Address Anomalies
    const addresses = extractIndividualAddresses(c.address || '');
    if (addresses.length > 1) {
      multiAddressAnomalies.push({
        customer: c,
        addresses,
      });
    }

    // 4. Map phones for Duplicate Phone Grouping (checks both phone and phone2)
    const allPhones = extractIndividualPhones(c.phone || '', c.phone2);
    if (allPhones.length > 0) {
      for (const p of allPhones) {
        const norm = normalizeSinglePhone(p);
        if (norm) {
          const list = phoneMap.get(norm) || [];
          if (!list.some(existing => existing.id === c.id)) {
            list.push(c);
          }
          phoneMap.set(norm, list);
        }
      }
    } else {
      for (const rawP of [c.phone, c.phone2].filter(Boolean) as string[]) {
        const norm = normalizeSinglePhone(rawP);
        if (norm) {
          const list = phoneMap.get(norm) || [];
          if (!list.some(existing => existing.id === c.id)) {
            list.push(c);
          }
          phoneMap.set(norm, list);
        }
      }
    }

    // 5. Check Historical Order Discrepancies
    if (orders.length > 0 && !isGenericCustomerName(c.name)) {
      const custOrders = orders.filter(
        o =>
          o.customerId === c.id ||
          (c.phone && o.customerPhone && isPhoneMatching(o.customerPhone, c.phone)) ||
          (c.phone2 && o.customerPhone && isPhoneMatching(o.customerPhone, c.phone2))
      );

      const differingPhones = new Set<string>();
      const differingAddresses = new Set<string>();
      const differingNames = new Set<string>();

      const cPhoneNorm = normalizeSinglePhone(c.phone || '');
      const cPhone2Norm = c.phone2 ? normalizeSinglePhone(c.phone2) : '';
      const knownAddrsLower = getAllCustomerAddresses(c).map(a => a.toLowerCase());
      const cNameNorm = (c.name || '').normalize('NFC').trim();

      for (const ord of custOrders) {
        const ordPhone = normalizeSinglePhone(ord.customerPhone || '');
        const matchesKnownPhone =
          Boolean(cPhoneNorm && (ordPhone === cPhoneNorm || isPhoneMatching(ordPhone, cPhoneNorm))) ||
          Boolean(cPhone2Norm && (ordPhone === cPhone2Norm || isPhoneMatching(ordPhone, cPhone2Norm)));

        if (ordPhone && !matchesKnownPhone && (cPhoneNorm || cPhone2Norm)) {
          differingPhones.add(ord.customerPhone!.trim());
        }

        const ordAddr = (ord.customerAddress || '').trim();
        const ordAddrLower = ordAddr.toLowerCase();
        const matchesKnownAddr =
          knownAddrsLower.length > 0 &&
          knownAddrsLower.some(ka => ka.includes(ordAddrLower) || ordAddrLower.includes(ka));
        if (ordAddr && ordAddr.length >= 3 && !matchesKnownAddr) {
          differingAddresses.add(ordAddr);
        }

        const ordName = (ord.customerName || '').normalize('NFC').trim();
        if (
          ordName &&
          !isGenericCustomerName(ordName) &&
          ordName !== cNameNorm &&
          (removeVietnameseTones(ordName) === removeVietnameseTones(cNameNorm) || ord.customerId === c.id)
        ) {
          // Tone twin name, distinct spelling, or alternate person on same customer ID
          differingNames.add(ordName);
        }
      }

      if (differingPhones.size > 0 || differingAddresses.size > 0 || differingNames.size > 0) {
        orderDiscrepancies.push({
          customer: c,
          historicalOrders: custOrders,
          differingPhones: Array.from(differingPhones),
          differingAddresses: Array.from(differingAddresses),
          differingNames: Array.from(differingNames),
        });
      }
    }
  }

  // Filter Tone Twins with > 1 customers
  const toneTwins: ToneTwinGroup[] = [];
  for (const [toneCleanName, group] of toneMap.entries()) {
    if (group.length > 1) {
      toneTwins.push({ toneCleanName, customers: group });
    }
  }

  // Filter Duplicate Phone Groups with > 1 customers
  const duplicatePhoneGroups: DuplicatePhoneGroup[] = [];
  for (const [normalizedPhone, group] of phoneMap.entries()) {
    if (group.length > 1) {
      duplicatePhoneGroups.push({ normalizedPhone, customers: group });
    }
  }

  const totalAnomalies =
    toneTwins.length +
    multiPhoneAnomalies.length +
    multiAddressAnomalies.length +
    duplicatePhoneGroups.length +
    orderDiscrepancies.length;

  return {
    totalAnomalies,
    toneTwins,
    multiPhoneAnomalies,
    multiAddressAnomalies,
    duplicatePhoneGroups,
    orderDiscrepancies,
  };
}

/**
 * Historical Ground Truth definitions for known customer recoveries.
 */
export const HISTORICAL_RECOVERIES = {
  THANH_HANG: {
    id: 'KH05',
    name: 'Thanh Hang',
    phone: '0988111222',
    address: '12 Hoàn Kiếm, Hà Nội',
  },
  THANH_HANG_DIACRITIC: {
    id: 'KH06',
    name: 'Thanh Hằng',
    phone: '0988333444',
    address: '45 Đội Cấn, Ba Đình, Hà Nội',
  },
};

/**
 * Automatically repair and migrate customer records and reassign affected orders:
 * 1. Historical recovery & separation for "Thanh Hang" and "Thanh Hằng".
 * 2. Formatting legacy 20-digit concatenated phones into clean delimited strings.
 * 3. Cleaning fused slashed names (with or without spaces).
 * 4. Re-linking order snapshots to decoupled customer IDs based on phone, address, and diacritics.
 * 5. Re-linking orphaned historical orders referencing legacy fused IDs.
 */
export function repairAndMigrateCustomers(
  customers: Customer[],
  orders: Order[] = []
): MigrationRepairResult {
  let list = customers.map(c => ({ ...c }));
  let ordersList = orders.map(o => ({ ...o }));
  const log: string[] = [];
  let changesCount = 0;

  // --------------------------------------------------------------------------
  // Step 1: Historical Data Recovery for "Thanh Hang" and "Thanh Hằng"
  // --------------------------------------------------------------------------
  const hangPhoneNoDiacritic = HISTORICAL_RECOVERIES.THANH_HANG.phone;
  const hangPhoneDiacritic = HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.phone;

  // Check if any customer contains both phones, both addresses, or fused name
  const isHangFused = (c: Customer) => {
    const rawName = (c.name || '').normalize('NFC');
    const cleanName = removeVietnameseTones(rawName);
    const isHang = cleanName === 'thanh hang' || cleanName.includes('thanh hang');
    const hasBothPhones =
      Boolean(c.phone && isPhoneMatching(c.phone, hangPhoneNoDiacritic) && isPhoneMatching(c.phone, hangPhoneDiacritic));
    const hasBothAddresses =
      Boolean(c.address && c.address.includes('Hoàn Kiếm') && c.address.includes('Đội Cấn'));
    const hasFusedName =
      Boolean(rawName.includes('/') && cleanName.includes('thanh hang'));
    return isHang && (hasBothPhones || hasBothAddresses || hasFusedName);
  };

  let fusedHangIndex = -1;
  while ((fusedHangIndex = list.findIndex(isHangFused)) !== -1) {
    const fused = list[fusedHangIndex];
    // Decouple into Thanh Hang (KH05) and Thanh Hằng (KH06)
    const custThanhHang: Customer = {
      ...fused,
      id: fused.id === 'KH06' ? 'KH05' : fused.id || 'KH05',
      name: HISTORICAL_RECOVERIES.THANH_HANG.name,
      phone: HISTORICAL_RECOVERIES.THANH_HANG.phone,
      address: HISTORICAL_RECOVERIES.THANH_HANG.address,
      debt: 0,
      totalSpent: 0,
      orderCount: 0,
      updatedAt: new Date().toISOString(),
    };

    const custThanhHangDiacritic: Customer = {
      id: 'KH06',
      name: HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.name,
      phone: HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.phone,
      address: HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.address,
      debt: fused.debt || 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: fused.createdAt || '2026-09-01T08:00:00Z',
      updatedAt: new Date().toISOString(),
    };

    list.splice(fusedHangIndex, 1, custThanhHang, custThanhHangDiacritic);
    changesCount++;
    log.push(
      `Decoupled fused customer "${fused.name}" into "${custThanhHang.name}" (${custThanhHang.id}) and "${custThanhHangDiacritic.name}" (${custThanhHangDiacritic.id})`
    );

    // Reassign orders that belonged to the fused ID
    for (const ord of ordersList) {
      if (ord.customerId === fused.id) {
        const orderPhone = ord.customerPhone || '';
        const orderAddr = ord.customerAddress || '';
        const orderName = (ord.customerName || '').normalize('NFC');

        if (
          isPhoneMatching(orderPhone, hangPhoneDiacritic) ||
          orderAddr.includes('Đội Cấn') ||
          (orderName.includes('Hằng') && !orderName.includes('Hang'))
        ) {
          ord.customerId = custThanhHangDiacritic.id;
          ord.customerName = custThanhHangDiacritic.name;
        } else {
          ord.customerId = custThanhHang.id;
          ord.customerName = custThanhHang.name;
        }
      }
    }
  }

  // Ensure both Thanh Hang and Thanh Hằng have pristine contact information if present
  let foundNoDiacritic = list.find(
    c => (c.name || '').normalize('NFC').trim() === HISTORICAL_RECOVERIES.THANH_HANG.name
  );
  let foundDiacritic = list.find(
    c => (c.name || '').normalize('NFC').trim() === HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.name
  );

  // If one of them is missing but referenced in orders, restore the missing record
  if (!foundDiacritic && ordersList.some(o => isPhoneMatching(o.customerPhone || '', hangPhoneDiacritic) || (o.customerName || '').normalize('NFC').includes('Hằng'))) {
    foundDiacritic = {
      id: 'KH06',
      name: HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.name,
      phone: HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.phone,
      address: HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.address,
      debt: 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: new Date().toISOString(),
    };
    list.push(foundDiacritic);
    changesCount++;
    log.push('Restored missing historical profile for "Thanh Hằng" (KH06)');
  }

  if (!foundNoDiacritic && ordersList.some(o => isPhoneMatching(o.customerPhone || '', hangPhoneNoDiacritic) || (o.customerName || '').normalize('NFC') === 'Thanh Hang')) {
    foundNoDiacritic = {
      id: 'KH05',
      name: HISTORICAL_RECOVERIES.THANH_HANG.name,
      phone: HISTORICAL_RECOVERIES.THANH_HANG.phone,
      address: HISTORICAL_RECOVERIES.THANH_HANG.address,
      debt: 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: new Date().toISOString(),
    };
    list.push(foundNoDiacritic);
    changesCount++;
    log.push('Restored missing historical profile for "Thanh Hang" (KH05)');
  }

  if (foundNoDiacritic) {
    if (
      foundNoDiacritic.phone !== HISTORICAL_RECOVERIES.THANH_HANG.phone ||
      foundNoDiacritic.address !== HISTORICAL_RECOVERIES.THANH_HANG.address
    ) {
      foundNoDiacritic.phone = HISTORICAL_RECOVERIES.THANH_HANG.phone;
      foundNoDiacritic.address = HISTORICAL_RECOVERIES.THANH_HANG.address;
      foundNoDiacritic.updatedAt = new Date().toISOString();
      changesCount++;
      log.push('Restored verified contact info for "Thanh Hang" (0988111222, 12 Hoàn Kiếm, Hà Nội)');
    }
  }

  if (foundDiacritic) {
    if (
      foundDiacritic.phone !== HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.phone ||
      foundDiacritic.address !== HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.address
    ) {
      foundDiacritic.phone = HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.phone;
      foundDiacritic.address = HISTORICAL_RECOVERIES.THANH_HANG_DIACRITIC.address;
      foundDiacritic.updatedAt = new Date().toISOString();
      changesCount++;
      log.push('Restored verified contact info for "Thanh Hằng" (0988333444, 45 Đội Cấn, Ba Đình, Hà Nội)');
    }
  }

  // Re-link any orphaned historical orders whose customerId no longer exists in list
  if (foundNoDiacritic && foundDiacritic) {
    for (const ord of ordersList) {
      if (!list.some(c => c.id === ord.customerId)) {
        const cleanOrdName = removeVietnameseTones(ord.customerName || '');
        const orderPhone = ord.customerPhone || '';
        const orderAddr = ord.customerAddress || '';
        const orderName = (ord.customerName || '').normalize('NFC');

        if (
          cleanOrdName === 'thanh hang' ||
          isPhoneMatching(orderPhone, hangPhoneNoDiacritic) ||
          isPhoneMatching(orderPhone, hangPhoneDiacritic)
        ) {
          if (
            isPhoneMatching(orderPhone, hangPhoneDiacritic) ||
            orderAddr.includes('Đội Cấn') ||
            (orderName.includes('Hằng') && !orderName.includes('Hang'))
          ) {
            ord.customerId = foundDiacritic.id;
            ord.customerName = foundDiacritic.name;
          } else {
            ord.customerId = foundNoDiacritic.id;
            ord.customerName = foundNoDiacritic.name;
          }
          changesCount++;
          log.push(`Re-linked orphaned order #${ord.id} to "${ord.customerName}" (${ord.customerId})`);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Step 2: Format concatenated 20-digit phones & normalize phone numbers
  // --------------------------------------------------------------------------
  for (const c of list) {
    if (c.phone) {
      // Migrate legacy slashed phones to phone + phone2 if phone2 is empty
      if (c.phone.includes(' / ') && !c.phone2) {
        const parts = c.phone.split(' / ').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          c.phone = parts[0];
          c.phone2 = parts.slice(1).join(' / ');
          c.updatedAt = new Date().toISOString();
          changesCount++;
          log.push(`Migrated concatenated phone to dual phone structure for customer "${c.name}" -> SĐT 1: ${c.phone}, SĐT 2: ${c.phone2}`);
        }
      } else {
        const normalized = normalizeVietnamesePhone(c.phone);
        if (normalized && normalized !== c.phone) {
          c.phone = normalized;
          c.updatedAt = new Date().toISOString();
          changesCount++;
          log.push(`Normalized phone format for customer "${c.name}" -> ${normalized}`);
        }
      }
    }
    if (c.phone2) {
      const normalized2 = normalizeVietnamesePhone(c.phone2);
      if (normalized2 && normalized2 !== c.phone2) {
        c.phone2 = normalized2;
        c.updatedAt = new Date().toISOString();
        changesCount++;
        log.push(`Normalized secondary phone format for customer "${c.name}" -> ${normalized2}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Step 3: Clean up multi-name slash artifacts (e.g. "Lan / Huong" or "Lan/Huong")
  // --------------------------------------------------------------------------
  for (const c of list) {
    if (c.name && c.name.includes('/') && !isGenericCustomerName(c.name)) {
      const nameParts = c.name.split(/\s*\/\s*/).map(n => n.trim()).filter(Boolean);
      if (nameParts.length > 1) {
        // Keep primary name for this customer
        c.name = nameParts[0];
        c.updatedAt = new Date().toISOString();
        changesCount++;
        log.push(`Cleaned slashed customer name "${nameParts.join(' / ')}" -> "${nameParts[0]}"`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Step 4: Recalculate order counts and total spent
  // --------------------------------------------------------------------------
  if (ordersList.length > 0) {
    for (const c of list) {
      const custOrders = ordersList.filter(o => o.customerId === c.id && o.status !== 'cancelled');
      const newCount = custOrders.length;
      const newTotal = custOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      if (c.orderCount !== newCount || c.totalSpent !== newTotal) {
        c.orderCount = newCount;
        c.totalSpent = newTotal;
      }
    }
  }

  return {
    repairedCustomers: list,
    repairedOrders: ordersList,
    changesCount,
    log,
  };
}

/**
 * Split a customer with multi-phones into two distinct customers.
 */
export function splitCustomerByPhones(
  customer: Customer,
  orders: Order[] = []
): {
  customerA: Customer;
  customerB: Customer;
  ordersToUpdate: Order[];
} {
  const phones = extractIndividualPhones(customer.phone, customer.phone2);
  const phone1 = phones[0] || customer.phone || '';
  const phone2 = phones[1] || '';

  const newId = `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const customerB: Customer = {
    id: newId,
    name: `${customer.name} (Phụ)`,
    phone: phone2,
    phone2: undefined,
    address: customer.address || '',
    debt: 0,
    totalSpent: 0,
    orderCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Check which orders used phone2
  const ordersToUpdate: Order[] = [];
  if (phone2) {
    for (const ord of orders) {
      if (ord.customerId === customer.id && ord.customerPhone && isPhoneMatching(ord.customerPhone, phone2)) {
        ordersToUpdate.push({
          ...ord,
          customerId: customerB.id,
          customerName: customerB.name,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Accurately compute orderCount and totalSpent for both customers
  if (orders.length > 0) {
    const ordersA = orders.filter(
      o => o.customerId === customer.id && !ordersToUpdate.some(u => u.id === o.id) && o.status !== 'cancelled'
    );
    const ordersB = ordersToUpdate.filter(o => o.status !== 'cancelled');

    const customerA: Customer = {
      ...customer,
      phone: phone1,
      phone2: undefined,
      orderCount: ordersA.length,
      totalSpent: ordersA.reduce((sum, o) => sum + (o.total || 0), 0),
      updatedAt: new Date().toISOString(),
    };

    customerB.orderCount = ordersB.length;
    customerB.totalSpent = ordersB.reduce((sum, o) => sum + (o.total || 0), 0);

    return { customerA, customerB, ordersToUpdate };
  }

  const customerA: Customer = {
    ...customer,
    phone: phone1,
    phone2: undefined,
    updatedAt: new Date().toISOString(),
  };

  return { customerA, customerB, ordersToUpdate };
}

/**
 * Split a customer with multi-addresses into two distinct customers.
 */
export function splitCustomerByAddresses(
  customer: Customer,
  orders: Order[] = []
): {
  customerA: Customer;
  customerB: Customer;
  ordersToUpdate: Order[];
} {
  const addresses = extractIndividualAddresses(customer.address);
  const addr1 = addresses[0] || customer.address;
  const addr2 = addresses[1] || '';

  const newId = `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const customerB: Customer = {
    id: newId,
    name: `${customer.name} (${addr2.slice(0, 15)}...)`,
    phone: customer.phone || '',
    address: addr2,
    debt: 0,
    totalSpent: 0,
    orderCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ordersToUpdate: Order[] = [];
  if (addr2) {
    for (const ord of orders) {
      if (ord.customerId === customer.id && ord.customerAddress && ord.customerAddress.includes(addr2)) {
        ordersToUpdate.push({
          ...ord,
          customerId: customerB.id,
          customerName: customerB.name,
          customerAddress: addr2,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  if (orders.length > 0) {
    const ordersA = orders.filter(
      o => o.customerId === customer.id && !ordersToUpdate.some(u => u.id === o.id) && o.status !== 'cancelled'
    );
    const ordersB = ordersToUpdate.filter(o => o.status !== 'cancelled');

    const customerA: Customer = {
      ...customer,
      address: addr1,
      orderCount: ordersA.length,
      totalSpent: ordersA.reduce((sum, o) => sum + (o.total || 0), 0),
      updatedAt: new Date().toISOString(),
    };

    customerB.orderCount = ordersB.length;
    customerB.totalSpent = ordersB.reduce((sum, o) => sum + (o.total || 0), 0);

    return { customerA, customerB, ordersToUpdate };
  }

  const customerA: Customer = {
    ...customer,
    address: addr1,
    updatedAt: new Date().toISOString(),
  };

  return { customerA, customerB, ordersToUpdate };
}

/**
 * Atomically merge 1+ duplicate customers into a primary customer (ADR-0021).
 * Preserves distinct phones into phone2, merges extraAddresses, sums debt/totalSpent/orderCount,
 * and reassigns all orders pointing to any duplicate ID.
 */
export function mergeCustomerGroupHelper(
  primaryCustomer: Customer,
  duplicateCustomers: Customer[],
  orders: Order[] = []
): {
  mergedCustomer: Customer;
  ordersToUpdate: Order[];
} {
  const seenDupIds = new Set<string>();
  const validDuplicates: Customer[] = [];
  for (const dup of duplicateCustomers || []) {
    if (!dup || !dup.id || dup.id === primaryCustomer.id || seenDupIds.has(dup.id)) continue;
    seenDupIds.add(dup.id);
    validDuplicates.push(dup);
  }

  if (validDuplicates.length === 0) {
    return { mergedCustomer: primaryCustomer, ordersToUpdate: [] };
  }

  const now = new Date().toISOString();

  // Collect distinct phones preserving primary.phone first
  const collectCustomerPhones = (cust: Customer): string[] => {
    const extracted = extractIndividualPhones(cust.phone || '', cust.phone2);
    if (extracted.length > 0) return extracted;
    return [cust.phone, cust.phone2]
      .map(p => String(p || '').trim())
      .filter(Boolean);
  };

  const primaryRawPhone = String(primaryCustomer.phone || '').trim();
  const distinctPhones: string[] = [];
  const pushDistinctPhone = (candidate: string) => {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) return;
    const alreadyExists = distinctPhones.some(
      existing =>
        isPhoneMatching(existing, trimmed) ||
        existing.toLowerCase() === trimmed.toLowerCase()
    );
    if (!alreadyExists) {
      distinctPhones.push(trimmed);
    }
  };

  if (primaryRawPhone) {
    const p1Extracted = extractIndividualPhones(primaryRawPhone);
    if (p1Extracted.length <= 1) {
      pushDistinctPhone(primaryRawPhone);
    } else {
      for (const p of p1Extracted) pushDistinctPhone(p);
    }
  }
  for (const p of extractIndividualPhones(primaryCustomer.phone2 || '')) {
    pushDistinctPhone(p);
  }
  if (primaryCustomer.phone2 && !primaryCustomer.phone2.includes('/')) {
    pushDistinctPhone(primaryCustomer.phone2);
  }
  for (const dup of validDuplicates) {
    for (const p of collectCustomerPhones(dup)) {
      pushDistinctPhone(p);
    }
  }

  const finalPhone = distinctPhones[0] || '';
  const secondaryList = distinctPhones.slice(1);
  const finalPhone2 = secondaryList.length > 0 ? secondaryList.join(' / ') : undefined;

  const extraAddrPool: string[] = [...(primaryCustomer.extraAddresses || [])];
  for (const dup of validDuplicates) {
    if (dup.address) extraAddrPool.push(dup.address);
    if (dup.extraAddresses && dup.extraAddresses.length > 0) {
      extraAddrPool.push(...dup.extraAddresses);
    }
  }

  const mergedAddrs = normalizeAddressList(primaryCustomer.address || '', extraAddrPool);

  let totalDebt = primaryCustomer.debt || 0;
  let totalSpent = primaryCustomer.totalSpent || 0;
  let totalOrderCount = primaryCustomer.orderCount || 0;
  for (const dup of validDuplicates) {
    totalDebt += dup.debt || 0;
    totalSpent += dup.totalSpent || 0;
    totalOrderCount += dup.orderCount || 0;
  }

  const mergedName =
    primaryCustomer.name && !isGenericCustomerName(primaryCustomer.name)
      ? primaryCustomer.name
      : validDuplicates.find(d => d.name && !isGenericCustomerName(d.name))?.name || primaryCustomer.name;

  const mergedCustomer: Customer = {
    ...primaryCustomer,
    name: mergedName,
    phone: finalPhone,
    phone2: finalPhone2,
    address: mergedAddrs.address,
    extraAddresses: mergedAddrs.extraAddresses,
    debt: totalDebt,
    totalSpent,
    orderCount: totalOrderCount,
    updatedAt: now,
  };

  const ordersToUpdate: Order[] = [];
  for (const ord of orders) {
    if (seenDupIds.has(ord.customerId)) {
      ordersToUpdate.push({
        ...ord,
        customerId: primaryCustomer.id,
        customerName: mergedCustomer.name,
        updatedAt: now,
      });
    }
  }

  return { mergedCustomer, ordersToUpdate };
}

/**
 * Merge a duplicate customer into a primary customer.
 */
export function mergeDuplicateCustomers(
  primaryCustomer: Customer,
  duplicateCustomer: Customer,
  orders: Order[] = []
): {
  mergedCustomer: Customer;
  ordersToUpdate: Order[];
} {
  return mergeCustomerGroupHelper(primaryCustomer, [duplicateCustomer], orders);
}

/**
 * 1-Click Restoration from Original Order Snapshot (ADR-0018)
 * Restores a customer's overwritten name, phone, or address back to the verified order snapshot.
 * Safeguard: Never overwrites a customer's real name with a generic retail placeholder ("Khách lẻ").
 */
export function restoreCustomerFromOrderSnapshot(
  customer: Customer,
  order: Order
): {
  updatedCustomer: Customer;
  log: string;
} {
  const newName =
    order.customerName && !isGenericCustomerName(order.customerName)
      ? order.customerName
      : customer.name;

  const restoredAddress = order.customerAddress || customer.address;
  const normalizedAddrs = normalizeAddressList(restoredAddress, customer.extraAddresses);

  const updatedCustomer: Customer = {
    ...customer,
    name: newName,
    phone: order.customerPhone || customer.phone,
    address: normalizedAddrs.address,
    extraAddresses: normalizedAddrs.extraAddresses,
    updatedAt: new Date().toISOString(),
  };

  const log = `Đã khôi phục thông tin khách "${customer.name}" theo đơn #${order.id}: Tên "${updatedCustomer.name}", SĐT "${updatedCustomer.phone}", ĐC "${updatedCustomer.address}"`;
  return { updatedCustomer, log };
}

/**
 * 1-Click Separation by Historical Order (ADR-0018)
 * Splits a customer when past orders contained a distinct phone number or person.
 * Automatically reassigns orders matching the target phone to the newly created customer.
 * Decouples concatenated phone numbers and accurately partitions order debt.
 */
export function splitCustomerByHistoricalOrder(
  customer: Customer,
  targetPhone: string,
  orders: Order[] = []
): {
  customerA: Customer;
  customerB: Customer;
  ordersToUpdate: Order[];
} {
  const normTarget = normalizeSinglePhone(targetPhone);
  const matchingOrders = orders.filter(
    o => o.customerId === customer.id && o.customerPhone && isPhoneMatching(o.customerPhone, normTarget)
  );

  const snapshotName = matchingOrders.find(
    o => o.customerName && !isGenericCustomerName(o.customerName) && o.customerName !== customer.name
  )?.customerName;
  const snapshotAddr = matchingOrders.find(
    o => o.customerAddress && o.customerAddress !== customer.address
  )?.customerAddress;

  const newId = `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const customerB: Customer = {
    id: newId,
    name: snapshotName || `${customer.name} (SĐT ${normTarget.slice(-4)})`,
    phone: normTarget,
    address: snapshotAddr || customer.address || '',
    debt: 0,
    totalSpent: 0,
    orderCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ordersToUpdate: Order[] = [];
  for (const ord of matchingOrders) {
    ordersToUpdate.push({
      ...ord,
      customerId: customerB.id,
      customerName: customerB.name,
      updatedAt: new Date().toISOString(),
    });
  }

  const remainingOrders = orders.filter(
    o => o.customerId === customer.id && !ordersToUpdate.some(u => u.id === o.id) && o.status !== 'cancelled'
  );
  const ordersB = ordersToUpdate.filter(o => o.status !== 'cancelled');

  // Decouple phones: if customer had multiple phones (phone or phone2), strip the split target phone from customerA
  const existingPhones = extractIndividualPhones(customer.phone || '', customer.phone2);
  const remainingPhones = existingPhones.filter(p => !isPhoneMatching(p, normTarget));
  let newPhoneA = remainingPhones[0] || '';
  let newPhone2A: string | undefined = remainingPhones[1] || undefined;
  if (!newPhoneA && newPhone2A) {
    newPhoneA = newPhone2A;
    newPhone2A = undefined;
  }

  // Partition debt based on split orders
  const debtB = ordersB.reduce((sum, o) => sum + (o.debtAmount || 0), 0);
  const debtA = Math.max(0, (customer.debt || 0) - debtB);

  const customerA: Customer = {
    ...customer,
    phone: newPhoneA,
    phone2: newPhone2A,
    debt: debtA,
    orderCount: remainingOrders.length,
    totalSpent: remainingOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    updatedAt: new Date().toISOString(),
  };

  customerB.debt = debtB;
  customerB.orderCount = ordersB.length;
  customerB.totalSpent = ordersB.reduce((sum, o) => sum + (o.total || 0), 0);

  return { customerA, customerB, ordersToUpdate };
}

// ============================================================================
// ADR-0021: Sentinel Intelligence, Ranking, Discrepancy Helpers & Persistence
// ============================================================================

export type ToneTwinRecommendation = 'delete_ghosts' | 'merge_into_primary' | 'keep_independent';

export interface ToneTwinAnalysis {
  recommendation: ToneTwinRecommendation;
  recommendedPrimaryId: string;
  ghostCustomerIds: string[];
  reasonLabel: string;
  actionLabel: string;
}

export type DiscrepancyActionType = 'add_phone2' | 'add_extra_address' | 'restore_order' | 'split_customer';

export interface DiscrepancyOrderAnalysis {
  recommendedAction: DiscrepancyActionType;
  actionLabel: string;
  reasonLabel: string;
  canAddPhone2: boolean;
  canAddExtraAddress: boolean;
  newPhone?: string;
  newAddress?: string;
}

export const SENTINEL_ACKS_STORAGE_KEY = 'mxc_sentinel_acks_v1';

export interface SentinelAcknowledgments {
  toneTwins: string[];
  multiAddresses: string[];
  discrepancies: string[];
}

/**
 * Determine whether a customer record is an empty phantom ("Hồ sơ trống")
 * that can be safely deleted without losing any contact info, debt, or order history.
 */
export function isEmptyGhostCustomer(customer: Customer, orders: Order[] = []): boolean {
  if (!customer) return false;
  const hasPhone = Boolean((customer.phone || '').trim() || (customer.phone2 || '').trim());
  if (hasPhone) return false;

  const hasAddress = Boolean(
    (customer.address || '').trim() ||
    (customer.extraAddresses && customer.extraAddresses.some(a => Boolean(a && a.trim())))
  );
  if (hasAddress) return false;

  if (Number(customer.debt || 0) !== 0) return false;

  const hasMatchingOrder = orders.some(o => o.customerId === customer.id);
  if (hasMatchingOrder) return false;

  if (orders.length === 0 && (customer.orderCount || 0) > 0) return false;

  return true;
}

/**
 * Rank candidate customers and pick the richest record as Primary:
 * Priority: orders count -> has debt -> has phone/phone2 -> has address/extraAddresses -> oldest createdAt.
 */
export function rankPrimaryCustomer(customers: Customer[], orders: Order[] = []): Customer {
  if (!customers || customers.length === 0) {
    throw new Error('rankPrimaryCustomer requires at least one customer');
  }
  if (customers.length === 1) return customers[0];

  const orderCountByCustId = new Map<string, number>();
  for (const ord of orders) {
    if (!ord.customerId) continue;
    orderCountByCustId.set(ord.customerId, (orderCountByCustId.get(ord.customerId) || 0) + 1);
  }

  const getOrderScore = (c: Customer): number => {
    const matched = orderCountByCustId.get(c.id) || 0;
    if (matched > 0) return matched;
    return orders.length === 0 ? (c.orderCount || 0) : 0;
  };

  const getCreatedTs = (c: Customer): number => {
    if (!c.createdAt) return Number.POSITIVE_INFINITY;
    const parsed = Date.parse(c.createdAt);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };

  const sorted = [...customers].sort((a, b) => {
    // 1. Orders count (descending)
    const ordDiff = getOrderScore(b) - getOrderScore(a);
    if (ordDiff !== 0) return ordDiff;

    // 2. Has debt (descending)
    const hasDebtA = (a.debt || 0) > 0 ? 1 : 0;
    const hasDebtB = (b.debt || 0) > 0 ? 1 : 0;
    if (hasDebtB !== hasDebtA) return hasDebtB - hasDebtA;

    // 3. Has phone/phone2 (descending)
    const hasPhoneA = (a.phone || '').trim() || (a.phone2 || '').trim() ? 1 : 0;
    const hasPhoneB = (b.phone || '').trim() || (b.phone2 || '').trim() ? 1 : 0;
    if (hasPhoneB !== hasPhoneA) return hasPhoneB - hasPhoneA;

    // 4. Has address/extraAddresses (descending)
    const hasAddrA =
      (a.address || '').trim() || (a.extraAddresses && a.extraAddresses.some(x => x.trim())) ? 1 : 0;
    const hasAddrB =
      (b.address || '').trim() || (b.extraAddresses && b.extraAddresses.some(x => x.trim())) ? 1 : 0;
    if (hasAddrB !== hasAddrA) return hasAddrB - hasAddrA;

    // 5. Oldest createdAt (ascending)
    const tsA = getCreatedTs(a);
    const tsB = getCreatedTs(b);
    if (tsA !== tsB) return tsA - tsB;

    // 6. Deterministic richness tie-breakers
    const debtDiff = (b.debt || 0) - (a.debt || 0);
    if (debtDiff !== 0) return debtDiff;
    const spentDiff = (b.totalSpent || 0) - (a.totalSpent || 0);
    if (spentDiff !== 0) return spentDiff;
    const phoneCountA = ((a.phone || '').trim() ? 1 : 0) + ((a.phone2 || '').trim() ? 1 : 0);
    const phoneCountB = ((b.phone || '').trim() ? 1 : 0) + ((b.phone2 || '').trim() ? 1 : 0);
    if (phoneCountB !== phoneCountA) return phoneCountB - phoneCountA;
    return (b.orderCount || 0) - (a.orderCount || 0);
  });

  return sorted[0];
}

/**
 * Analyze a Tone Twin collision group and recommend the safest high-leverage action.
 */
export function analyzeToneTwinGroup(group: ToneTwinGroup, orders: Order[] = []): ToneTwinAnalysis {
  const customers = group.customers || [];
  const ghosts = customers.filter(c => isEmptyGhostCustomer(c, orders));
  const nonGhosts = customers.filter(c => !isEmptyGhostCustomer(c, orders));

  const primary = rankPrimaryCustomer(nonGhosts.length > 0 ? nonGhosts : customers, orders);

  // Case 1: One or more empty phantom profiles exist
  if (ghosts.length > 0 && nonGhosts.length >= 1) {
    const ghostCustomerIds = ghosts.map(g => g.id);
    const actionLabel =
      ghostCustomerIds.length === 1
        ? `Xóa hồ sơ trống #${ghostCustomerIds[0]}`
        : `Xóa ${ghostCustomerIds.length} hồ sơ trống`;
    return {
      recommendation: 'delete_ghosts',
      recommendedPrimaryId: primary.id,
      ghostCustomerIds,
      reasonLabel: `Phát hiện ${ghostCustomerIds.length} hồ sơ trống (không SĐT, không địa chỉ, 0 đơn, 0 nợ) trùng tên với "${primary.name}" (#${primary.id}).`,
      actionLabel,
    };
  }

  if (ghosts.length > 1 && nonGhosts.length === 0) {
    const ghostCustomerIds = ghosts.filter(g => g.id !== primary.id).map(g => g.id);
    return {
      recommendation: 'delete_ghosts',
      recommendedPrimaryId: primary.id,
      ghostCustomerIds,
      reasonLabel: `Cả ${ghosts.length} hồ sơ đều trống dữ liệu — giữ lại #${primary.id} và xóa ${ghostCustomerIds.length} bản sao trống.`,
      actionLabel: `Xóa ${ghostCustomerIds.length} hồ sơ trống`,
    };
  }

  // Case 2: All profiles have some data — check phone overlap, exact name, or shared address
  const phoneSets = customers.map(c => extractIndividualPhones(c.phone || '', c.phone2));
  let hasOverlappingPhone = false;
  let profilesWithPhones = 0;

  for (let i = 0; i < phoneSets.length; i++) {
    if (phoneSets[i].length > 0) profilesWithPhones++;
    for (let j = i + 1; j < phoneSets.length; j++) {
      if (phoneSets[i].some(pa => phoneSets[j].some(pb => isPhoneMatching(pa, pb)))) {
        hasOverlappingPhone = true;
      }
    }
  }

  const normalizedNames = customers.map(c => (c.name || '').normalize('NFC').trim().toLowerCase());
  const hasSameExactName = normalizedNames.length > 1 && normalizedNames.every(n => n === normalizedNames[0]);

  let hasMatchingAddress = false;
  for (let i = 0; i < customers.length; i++) {
    const addrsA = getAllCustomerAddresses(customers[i]);
    for (let j = i + 1; j < customers.length; j++) {
      const addrsB = getAllCustomerAddresses(customers[j]);
      if (addrsA.some(aa => addrsB.some(ab => isAddressMatching(aa, ab)))) {
        hasMatchingAddress = true;
      }
    }
  }

  // If phones overlap OR (at least one lacks phone and same exact name or matching address) -> merge into primary
  if (hasOverlappingPhone || (profilesWithPhones < customers.length && (hasSameExactName || hasMatchingAddress))) {
    return {
      recommendation: 'merge_into_primary',
      recommendedPrimaryId: primary.id,
      ghostCustomerIds: [],
      reasonLabel: hasOverlappingPhone
        ? `Trùng SĐT hoặc thông tin liên hệ — nên gộp vào hồ sơ đầy đủ nhất "${primary.name}" (#${primary.id}).`
        : `Cùng tên "${primary.name}" và có hồ sơ thiếu SĐT — nên gộp vào #${primary.id} để không phân mảnh lịch sử.`,
      actionLabel: `Gộp vào ${primary.name} (#${primary.id})`,
    };
  }

  return {
    recommendation: 'keep_independent',
    recommendedPrimaryId: primary.id,
    ghostCustomerIds: [],
    reasonLabel: `Các hồ sơ có SĐT hoặc dấu tiếng Việt khác nhau — nhiều khả năng là ${customers.length} khách hàng độc lập.`,
    actionLabel: `Xác nhận ${customers.length} khách độc lập`,
  };
}

/**
 * Classify a historical order discrepancy and recommend the best non-destructive/restorative action.
 */
export function analyzeDiscrepancyOrder(customer: Customer, order: Order): DiscrepancyOrderAnalysis {
  const ordPhoneRaw = (order.customerPhone || '').trim();
  const ordPhoneNorm = ordPhoneRaw ? normalizeSinglePhone(ordPhoneRaw) : '';
  const ordPhoneFormatted = ordPhoneRaw ? normalizeVietnamesePhone(ordPhoneRaw) || ordPhoneNorm : '';
  const existingPhones = extractIndividualPhones(customer.phone || '', customer.phone2);
  const phoneKnown =
    !ordPhoneNorm || existingPhones.some(p => isPhoneMatching(p, ordPhoneNorm));
  const canAddPhone2 = Boolean(ordPhoneNorm && !phoneKnown);

  const ordAddrRaw = (order.customerAddress || '').trim();
  const ordAddrLower = ordAddrRaw.toLowerCase();
  const knownAddrs = getAllCustomerAddresses(customer);
  const knownAddrsLower = knownAddrs.map(a => a.toLowerCase());
  const addrKnown =
    !ordAddrRaw ||
    ordAddrRaw.length < 3 ||
    knownAddrs.some(ka => isAddressMatching(ka, ordAddrRaw)) ||
    knownAddrsLower.some(ka => ka.includes(ordAddrLower) || ordAddrLower.includes(ka));
  const canAddExtraAddress = Boolean(ordAddrRaw && ordAddrRaw.length >= 3 && !addrKnown);

  const custNameNorm = (customer.name || '').normalize('NFC').trim();
  const ordNameNorm = (order.customerName || '').normalize('NFC').trim();
  const ordNameClean = removeVietnameseTones(ordNameNorm);
  const custNameClean = removeVietnameseTones(custNameNorm);
  const isDistinctNonGenericOrderName = Boolean(
    ordNameNorm &&
      !isGenericCustomerName(ordNameNorm) &&
      ordNameNorm !== custNameNorm
  );

  // If order has a different person's name (or diacritic-different name) AND a different phone -> split into 2 customers
  if (
    canAddPhone2 &&
    isDistinctNonGenericOrderName &&
    (ordNameClean !== custNameClean || ordNameNorm.toLowerCase() !== custNameNorm.toLowerCase())
  ) {
    return {
      recommendedAction: 'split_customer',
      actionLabel: 'Tách thành 2 khách',
      reasonLabel: `Đơn #${order.id} dùng tên "${ordNameNorm}" và SĐT khác (${ordPhoneFormatted}) — có thể là người mua khác.`,
      canAddPhone2,
      canAddExtraAddress,
      newPhone: ordPhoneFormatted || undefined,
      newAddress: canAddExtraAddress ? ordAddrRaw : undefined,
    };
  }

  // If profile is missing primary phone/address that exists on the order -> restore from order
  if ((!(customer.phone || '').trim() && ordPhoneNorm) || (!(customer.address || '').trim() && ordAddrRaw.length >= 3)) {
    return {
      recommendedAction: 'restore_order',
      actionLabel: 'Khôi phục theo đơn',
      reasonLabel: `Hồ sơ đang thiếu thông tin liên hệ gốc có trên đơn #${order.id}.`,
      canAddPhone2,
      canAddExtraAddress,
      newPhone: ordPhoneFormatted || undefined,
      newAddress: canAddExtraAddress ? ordAddrRaw : undefined,
    };
  }

  // Same customer using a second phone number -> non-destructive + Lưu làm SĐT 2
  if (canAddPhone2) {
    return {
      recommendedAction: 'add_phone2',
      actionLabel: '+ Lưu làm SĐT 2',
      reasonLabel: `Đơn #${order.id} dùng SĐT mới ${ordPhoneFormatted} — lưu làm SĐT 2 mà không ghi đè SĐT chính.`,
      canAddPhone2,
      canAddExtraAddress,
      newPhone: ordPhoneFormatted || undefined,
      newAddress: canAddExtraAddress ? ordAddrRaw : undefined,
    };
  }

  // Same customer delivering to another address -> non-destructive + Thêm làm Đ/C phụ
  if (canAddExtraAddress) {
    return {
      recommendedAction: 'add_extra_address',
      actionLabel: '+ Thêm làm Đ/C phụ',
      reasonLabel: `Đơn #${order.id} giao tới địa chỉ mới "${ordAddrRaw}" — thêm vào Địa chỉ phụ và giữ nguyên Đ/C chính.`,
      canAddPhone2,
      canAddExtraAddress,
      newPhone: undefined,
      newAddress: ordAddrRaw,
    };
  }

  return {
    recommendedAction: 'restore_order',
    actionLabel: 'Khôi phục theo đơn',
    reasonLabel: `Tên/thông tin trên đơn #${order.id} khác với hồ sơ hiện tại.`,
    canAddPhone2,
    canAddExtraAddress,
  };
}

/**
 * Non-destructively add a new secondary phone number from a historical order without overwriting primary phone.
 */
export function addSecondaryPhoneFromOrderHelper(
  customer: Customer,
  phone: string,
  timestamp = new Date().toISOString()
): { customer: Customer; changed: boolean } {
  const raw = String(phone || '').trim();
  const normSingle = normalizeSinglePhone(raw);
  if (!normSingle) {
    return { customer, changed: false };
  }
  const formatted = normalizeVietnamesePhone(raw) || normSingle;

  const existingPhones = extractIndividualPhones(customer.phone || '', customer.phone2);
  if (existingPhones.some(p => isPhoneMatching(p, normSingle))) {
    return { customer, changed: false };
  }

  const currentPhone = (customer.phone || '').trim();
  const currentPhone2 = (customer.phone2 || '').trim();

  if (!currentPhone) {
    return {
      customer: {
        ...customer,
        phone: formatted,
        updatedAt: timestamp,
      },
      changed: true,
    };
  }

  const nextPhone2 = currentPhone2 ? `${currentPhone2} / ${formatted}` : formatted;
  return {
    customer: {
      ...customer,
      phone2: nextPhone2,
      updatedAt: timestamp,
    },
    changed: true,
  };
}

/**
 * Non-destructively add a new extra delivery address from a historical order without overwriting primary address.
 */
export function addExtraAddressFromOrderHelper(
  customer: Customer,
  address: string,
  timestamp = new Date().toISOString()
): { customer: Customer; changed: boolean } {
  const trimmed = String(address || '').trim();
  if (trimmed.length < 3) {
    return { customer, changed: false };
  }

  const known = getAllCustomerAddresses(customer);
  if (known.some(ka => isAddressMatching(ka, trimmed))) {
    return { customer, changed: false };
  }

  const normalized = normalizeAddressList(customer.address || '', [
    ...(customer.extraAddresses || []),
    trimmed,
  ]);

  const currentExtras = customer.extraAddresses || [];
  const nextExtras = normalized.extraAddresses || [];
  const samePrimary = normalized.address === (customer.address || '').trim();
  const sameExtras =
    currentExtras.length === nextExtras.length &&
    currentExtras.every((val, idx) => val === nextExtras[idx]);

  if (samePrimary && sameExtras) {
    return { customer, changed: false };
  }

  return {
    customer: {
      ...customer,
      address: normalized.address,
      extraAddresses: normalized.extraAddresses,
      updatedAt: timestamp,
    },
    changed: true,
  };
}

const EMPTY_SENTINEL_ACKS: SentinelAcknowledgments = {
  toneTwins: [],
  multiAddresses: [],
  discrepancies: [],
};

function sanitizeAckList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map(x => String(x || '').trim()).filter(Boolean)));
}

export function loadSentinelAcks(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null
): SentinelAcknowledgments {
  if (!storage) return { ...EMPTY_SENTINEL_ACKS };
  try {
    const raw = storage.getItem(SENTINEL_ACKS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_SENTINEL_ACKS };
    const parsed = JSON.parse(raw);
    return {
      toneTwins: sanitizeAckList(parsed?.toneTwins),
      multiAddresses: sanitizeAckList(parsed?.multiAddresses),
      discrepancies: sanitizeAckList(parsed?.discrepancies),
    };
  } catch {
    return { ...EMPTY_SENTINEL_ACKS };
  }
}

export function saveSentinelAcks(
  acks: SentinelAcknowledgments,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null
): SentinelAcknowledgments {
  const clean: SentinelAcknowledgments = {
    toneTwins: sanitizeAckList(acks.toneTwins),
    multiAddresses: sanitizeAckList(acks.multiAddresses),
    discrepancies: sanitizeAckList(acks.discrepancies),
  };
  if (storage) {
    try {
      storage.setItem(SENTINEL_ACKS_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore storage quota errors
    }
  }
  return clean;
}

export function resetSentinelAcksStorage(
  storage: Pick<Storage, 'removeItem' | 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null
): SentinelAcknowledgments {
  if (storage) {
    try {
      storage.removeItem(SENTINEL_ACKS_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  return { ...EMPTY_SENTINEL_ACKS };
}

export function getSentinelAcknowledgedCount(acks: SentinelAcknowledgments): number {
  return (acks.toneTwins?.length || 0) + (acks.multiAddresses?.length || 0) + (acks.discrepancies?.length || 0);
}

/**
 * Filter a raw audit result using persisted Sentinel acknowledgments.
 * Keeps raw auditCustomerData untouched while honoring dismissed items across modal open/close cycles.
 */
export function filterAuditResultByAcks(
  auditResult: CustomerAnomalyAuditResult,
  acks: SentinelAcknowledgments
): CustomerAnomalyAuditResult {
  const toneSet = new Set(acks.toneTwins || []);
  const addrSet = new Set(acks.multiAddresses || []);
  const discSet = new Set(acks.discrepancies || []);

  const toneTwins = auditResult.toneTwins.filter(g => !toneSet.has(g.toneCleanName));
  const multiAddressAnomalies = auditResult.multiAddressAnomalies.filter(a => !addrSet.has(a.customer.id));

  const orderDiscrepancies: CustomerOrderDiscrepancy[] = [];
  for (const disc of auditResult.orderDiscrepancies || []) {
    if (discSet.has(disc.customer.id)) continue;

    const differingOrders = disc.historicalOrders.filter(
      o =>
        (o.customerPhone && disc.differingPhones.includes(o.customerPhone.trim())) ||
        (o.customerAddress && disc.differingAddresses.includes(o.customerAddress.trim())) ||
        (o.customerName && disc.differingNames.includes(o.customerName.trim()))
    );

    if (differingOrders.length === 0) {
      orderDiscrepancies.push(disc);
      continue;
    }

    const unackedOrders = differingOrders.filter(o => !discSet.has(`${disc.customer.id}::${o.id}`));
    if (unackedOrders.length === 0) continue;

    orderDiscrepancies.push({
      ...disc,
      historicalOrders: disc.historicalOrders.filter(o => !discSet.has(`${disc.customer.id}::${o.id}`)),
    });
  }

  const totalAnomalies =
    toneTwins.length +
    auditResult.multiPhoneAnomalies.length +
    multiAddressAnomalies.length +
    auditResult.duplicatePhoneGroups.length +
    orderDiscrepancies.length;

  return {
    totalAnomalies,
    toneTwins,
    multiPhoneAnomalies: auditResult.multiPhoneAnomalies,
    multiAddressAnomalies,
    duplicatePhoneGroups: auditResult.duplicatePhoneGroups,
    orderDiscrepancies,
  };
}

/**
 * Safe batch deletion helper (ADR-0021).
 * Distinguishes empty/0-debt/0-order customers from customers with debt or order history when `onlySafe` is enabled.
 */
export function deleteCustomersBatchHelper(
  customers: Customer[],
  orders: Order[],
  ids: string[],
  options?: { onlySafe?: boolean }
): {
  nextCustomers: Customer[];
  deletedIds: string[];
  deletedCount: number;
  skippedIds: string[];
} {
  const uniqueIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { nextCustomers: customers, deletedIds: [], deletedCount: 0, skippedIds: [] };
  }

  const custById = new Map(customers.map(c => [c.id, c]));
  const orderCustIds = new Set(orders.map(o => o.customerId));
  const toDeleteIds = new Set<string>();
  const skippedIds: string[] = [];

  for (const id of uniqueIds) {
    const cust = custById.get(id);
    if (!cust) {
      skippedIds.push(id);
      continue;
    }
    if (options?.onlySafe) {
      const hasDebt = Number(cust.debt || 0) > 0;
      const hasOrders = orderCustIds.has(cust.id) || Number(cust.orderCount || 0) > 0;
      if (hasDebt || hasOrders) {
        skippedIds.push(id);
        continue;
      }
    }
    toDeleteIds.add(id);
  }

  if (toDeleteIds.size === 0) {
    return { nextCustomers: customers, deletedIds: [], deletedCount: 0, skippedIds };
  }

  const deletedIds = Array.from(toDeleteIds);
  const nextCustomers = customers.filter(c => !toDeleteIds.has(c.id));
  return {
    nextCustomers,
    deletedIds,
    deletedCount: deletedIds.length,
    skippedIds,
  };
}
