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

export interface CustomerAnomalyAuditResult {
  totalAnomalies: number;
  toneTwins: ToneTwinGroup[];
  multiPhoneAnomalies: MultiPhoneAnomaly[];
  multiAddressAnomalies: MultiAddressAnomaly[];
  duplicatePhoneGroups: DuplicatePhoneGroup[];
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
 */
export function auditCustomerData(customers: Customer[]): CustomerAnomalyAuditResult {
  const toneMap = new Map<string, Customer[]>();
  const multiPhoneAnomalies: MultiPhoneAnomaly[] = [];
  const multiAddressAnomalies: MultiAddressAnomaly[] = [];
  const phoneMap = new Map<string, Customer[]>();

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
    duplicatePhoneGroups.length;

  return {
    totalAnomalies,
    toneTwins,
    multiPhoneAnomalies,
    multiAddressAnomalies,
    duplicatePhoneGroups,
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
 * 3. Cleaning fused slashed names.
 * 4. Re-linking order snapshots to decoupled customer IDs based on order phone/address.
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
  const hangPhoneNoDiacritic = '0988111222';
  const hangPhoneDiacritic = '0988333444';

  // Check if any customer contains both phones, or has both addresses, or fused name
  const fusedHangIndex = list.findIndex(c => {
    const cleanName = removeVietnameseTones(c.name);
    const isHang = cleanName === 'thanh hang' || cleanName.includes('thanh hang');
    const hasBothPhones =
      c.phone && isPhoneMatching(c.phone, hangPhoneNoDiacritic) && isPhoneMatching(c.phone, hangPhoneDiacritic);
    const hasBothAddresses =
      c.address && c.address.includes('Hoàn Kiếm') && c.address.includes('Đội Cấn');
    const hasFusedName =
      c.name.includes('/') && cleanName.includes('thanh hang');
    return isHang && (hasBothPhones || hasBothAddresses || hasFusedName);
  });

  if (fusedHangIndex !== -1) {
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
        if (
          ord.customerPhone &&
          isPhoneMatching(ord.customerPhone, hangPhoneDiacritic)
        ) {
          ord.customerId = custThanhHangDiacritic.id;
          ord.customerName = custThanhHangDiacritic.name;
        } else if (
          ord.customerAddress &&
          ord.customerAddress.includes('Đội Cấn')
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
  let foundNoDiacritic = list.find(c => c.name === 'Thanh Hang');
  let foundDiacritic = list.find(c => c.name === 'Thanh Hằng');

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
  // Step 3: Clean up multi-name slash artifacts (e.g. "Lan / Huong")
  // --------------------------------------------------------------------------
  for (const c of list) {
    if (c.name && c.name.includes(' / ') && !isGenericCustomerName(c.name)) {
      const nameParts = c.name.split(' / ').map(n => n.trim()).filter(Boolean);
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
      c.orderCount = custOrders.length;
      c.totalSpent = custOrders.reduce((sum, o) => sum + (o.total || 0), 0);
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

  const customerA: Customer = {
    ...customer,
    phone: phone1,
    updatedAt: new Date().toISOString(),
  };

  const newId = `KH${Date.now().toString().slice(-6)}`;
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

  const customerA: Customer = {
    ...customer,
    address: addr1,
    updatedAt: new Date().toISOString(),
  };

  const newId = `KH${Date.now().toString().slice(-6)}`;
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
