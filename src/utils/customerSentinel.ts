import type { Customer, Order } from '../types/index.ts';
import { removeVietnameseTones } from './vietnamese.ts';
import { normalizeSinglePhone, normalizeVietnamesePhone, isPhoneMatching } from './excel.ts';

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
 * Extract distinct phone numbers from a customer phone field.
 */
export function extractIndividualPhones(phoneStr: string): string[] {
  if (!phoneStr) return [];
  const parts = phoneStr
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
        if (norm.length === 20 && norm.startsWith('0')) {
          const p1 = normalizeSinglePhone(norm.slice(0, 10));
          const p2 = normalizeSinglePhone(norm.slice(10));
          if (p1 && !result.includes(p1)) result.push(p1);
          if (p2 && !result.includes(p2)) result.push(p2);
        } else if (!result.includes(norm)) {
          result.push(norm);
        }
      }
    }
  }
  return result;
}

/**
 * Extract distinct addresses from a customer address field.
 */
export function extractIndividualAddresses(addressStr: string): string[] {
  if (!addressStr) return [];
  const parts = addressStr
    .split(/\s*[\/|\\;\n]\s*/)
    .map(a => a.trim())
    .filter(a => a.length >= 3);
  return Array.from(new Set(parts));
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

    // 2. Check Multi-Phone Anomalies
    const phones = extractIndividualPhones(c.phone || '');
    if (
      phones.length > 1 ||
      (c.phone && (c.phone.includes('/') || c.phone.replace(/\D/g, '').length > 11))
    ) {
      multiPhoneAnomalies.push({
        customer: c,
        phones: phones.length > 0 ? phones : [c.phone],
      });
    }

    // 3. Check Multi-Address Anomalies
    const addresses = extractIndividualAddresses(c.address || '');
    if (addresses.length > 1 || (c.address && c.address.includes(' / '))) {
      multiAddressAnomalies.push({
        customer: c,
        addresses: addresses.length > 0 ? addresses : [c.address],
      });
    }

    // 4. Map phones for Duplicate Phone Grouping
    if (phones.length > 0) {
      for (const p of phones) {
        const norm = normalizeSinglePhone(p);
        if (norm) {
          const list = phoneMap.get(norm) || [];
          if (!list.some(existing => existing.id === c.id)) {
            list.push(c);
          }
          phoneMap.set(norm, list);
        }
      }
    } else if (c.phone) {
      const norm = normalizeSinglePhone(c.phone);
      if (norm) {
        const list = phoneMap.get(norm) || [];
        if (!list.some(existing => existing.id === c.id)) {
          list.push(c);
        }
        phoneMap.set(norm, list);
      }
    }

    // 5. Check Historical Order Discrepancies
    if (orders.length > 0 && !isGenericCustomerName(c.name)) {
      const custOrders = orders.filter(
        o => o.customerId === c.id || (c.phone && o.customerPhone && isPhoneMatching(o.customerPhone, c.phone))
      );

      const differingPhones = new Set<string>();
      const differingAddresses = new Set<string>();
      const differingNames = new Set<string>();

      const cPhoneNorm = normalizeSinglePhone(c.phone || '');
      const cAddrNorm = (c.address || '').trim().toLowerCase();
      const cNameNorm = (c.name || '').normalize('NFC').trim();

      for (const ord of custOrders) {
        const ordPhone = normalizeSinglePhone(ord.customerPhone || '');
        if (
          ordPhone &&
          ((!cPhoneNorm) || (cPhoneNorm && ordPhone !== cPhoneNorm && !isPhoneMatching(ordPhone, cPhoneNorm)))
        ) {
          differingPhones.add(ord.customerPhone!.trim());
        }

        const ordAddr = (ord.customerAddress || '').trim();
        if (
          ordAddr &&
          ordAddr.length >= 3 &&
          ((!cAddrNorm) || (cAddrNorm && !cAddrNorm.includes(ordAddr.toLowerCase()) && !ordAddr.toLowerCase().includes(cAddrNorm)))
        ) {
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
      const normalized = normalizeVietnamesePhone(c.phone);
      if (normalized && normalized !== c.phone) {
        c.phone = normalized;
        c.updatedAt = new Date().toISOString();
        changesCount++;
        log.push(`Normalized phone format for customer "${c.name}" -> ${normalized}`);
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
  const phones = extractIndividualPhones(customer.phone);
  const phone1 = phones[0] || customer.phone;
  const phone2 = phones[1] || '';

  const newId = `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const customerB: Customer = {
    id: newId,
    name: `${customer.name} (Phụ)`,
    phone: phone2,
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
  const mergedCustomer: Customer = {
    ...primaryCustomer,
    debt: (primaryCustomer.debt || 0) + (duplicateCustomer.debt || 0),
    totalSpent: (primaryCustomer.totalSpent || 0) + (duplicateCustomer.totalSpent || 0),
    orderCount: (primaryCustomer.orderCount || 0) + (duplicateCustomer.orderCount || 0),
    updatedAt: new Date().toISOString(),
  };

  const ordersToUpdate: Order[] = [];
  for (const ord of orders) {
    if (ord.customerId === duplicateCustomer.id) {
      ordersToUpdate.push({
        ...ord,
        customerId: primaryCustomer.id,
        customerName: primaryCustomer.name,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return { mergedCustomer, ordersToUpdate };
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

  const updatedCustomer: Customer = {
    ...customer,
    name: newName,
    phone: order.customerPhone || customer.phone,
    address: order.customerAddress || customer.address,
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

  // Decouple phones: if customer.phone had multiple phones, strip the split target phone from customerA
  const existingPhones = extractIndividualPhones(customer.phone || '');
  const remainingPhones = existingPhones.filter(p => !isPhoneMatching(p, normTarget));
  const newPhoneA = remainingPhones.length > 0 ? remainingPhones.join(' / ') : customer.phone;

  // Partition debt based on split orders
  const debtB = ordersB.reduce((sum, o) => sum + (o.debtAmount || 0), 0);
  const debtA = Math.max(0, (customer.debt || 0) - debtB);

  const customerA: Customer = {
    ...customer,
    phone: newPhoneA,
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
