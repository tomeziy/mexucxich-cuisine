import type { Product, Customer, Order } from '../types/index.ts';
import type { ParsedProductRow, ParsedCustomerRow } from './excel.ts';
import {
  normalizeVietnamesePhone,
  isPhoneMatching,
  extractMissingProductsFromOrders,
} from './excel.ts';
import { removeVietnameseTones } from './vietnamese.ts';
import { normalizeAddressList } from './addressUtils.ts';

export interface ImportFieldDiff {
  field: string;
  label: string;
  oldValue: string | number;
  newValue: string | number;
}

// ============================================================================
// 1. PRODUCT EXCEL IMPORT RECONCILIATION
// ============================================================================

export type ProductImportDiffStatus =
  | 'new'
  | 'identical'
  | 'info_changed'
  | 'stock_changed'
  | 'both_changed';

export type ProductImportAction =
  | 'create'
  | 'update_info'
  | 'overwrite'
  | 'accumulate'
  | 'skip';

export type MissingProductAction = 'keep' | 'delete';

export interface AnalyzedProductImportRow extends ParsedProductRow {
  id: string;
  isDuplicate: boolean;
  existingProduct?: Product;
  diffStatus: ProductImportDiffStatus;
  diffs: ImportFieldDiff[];
  recommendedAction: ProductImportAction;
  action: ProductImportAction;
}

export interface MissingCatalogProductItem {
  product: Product;
  action: MissingProductAction;
}

function normalizeProductNameKey(name: string): string {
  return removeVietnameseTones(String(name || '')).trim().toLowerCase();
}

function hasVietnameseDiacritics(value: string): boolean {
  return removeVietnameseTones(value) !== value;
}

function numbersDiffer(a: number | undefined, b: number | undefined): boolean {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) > 1e-6;
}

/**
 * Analyze parsed product Excel rows against the live store catalog:
 * - Aggregates duplicate names within the uploaded file
 * - Builds field-level diffs (`price`, `cost`, `unit`, `category`, `stock`)
 * - Defaults identical rows to `'skip'` (preventing stock doubling)
 * - Identifies catalog products absent from the uploaded file (`missingFromFile`)
 */
export function analyzeProductImportRows(
  parsedRows: ParsedProductRow[],
  existingProducts: Product[],
  nowTs = Date.now()
): {
  rows: AnalyzedProductImportRow[];
  missingFromFile: MissingCatalogProductItem[];
} {
  // Aggregate duplicate product names inside the uploaded Excel file first
  const aggregatedMap = new Map<string, ParsedProductRow>();
  for (const raw of parsedRows || []) {
    const cleanName = String(raw?.name || '').trim();
    if (!cleanName) continue;
    const key = normalizeProductNameKey(cleanName);
    const existingInFile = aggregatedMap.get(key);
    if (existingInFile) {
      aggregatedMap.set(key, {
        ...existingInFile,
        name: hasVietnameseDiacritics(cleanName) ? cleanName : existingInFile.name,
        category: String(raw.category || '').trim() || existingInFile.category,
        unit: String(raw.unit || '').trim() || existingInFile.unit,
        cost: Number(raw.cost) > 0 ? Number(raw.cost) : existingInFile.cost,
        price: Number(raw.price) > 0 ? Number(raw.price) : existingInFile.price,
        stock: (Number(existingInFile.stock) || 0) + (Number(raw.stock) || 0),
        image: raw.image || existingInFile.image || '🌭',
      });
    } else {
      aggregatedMap.set(key, {
        name: cleanName,
        category: String(raw.category || '').trim() || 'Đồ tự làm',
        unit: String(raw.unit || '').trim() || 'Gói 500g',
        cost: Number(raw.cost) || 0,
        price: Number(raw.price) || 0,
        stock: Number(raw.stock) || 0,
        image: raw.image || '🌭',
      });
    }
  }

  const existingByKey = new Map<string, Product>();
  for (const prod of existingProducts || []) {
    const key = normalizeProductNameKey(prod.name);
    if (key && !existingByKey.has(key)) {
      existingByKey.set(key, prod);
    }
  }

  const rows: AnalyzedProductImportRow[] = [];
  let idx = 0;

  for (const [key, row] of aggregatedMap.entries()) {
    const existing = existingByKey.get(key);
    const id = `prod_row_${nowTs}_${idx++}`;

    if (!existing) {
      rows.push({
        ...row,
        id,
        isDuplicate: false,
        diffStatus: 'new',
        diffs: [],
        recommendedAction: 'create',
        action: 'create',
      });
      continue;
    }

    const diffs: ImportFieldDiff[] = [];
    let infoChanged = false;
    let stockChanged = false;

    if (numbersDiffer(existing.price, row.price)) {
      diffs.push({
        field: 'price',
        label: 'Giá bán',
        oldValue: Number(existing.price) || 0,
        newValue: Number(row.price) || 0,
      });
      infoChanged = true;
    }
    if (numbersDiffer(existing.cost, row.cost)) {
      diffs.push({
        field: 'cost',
        label: 'Giá vốn',
        oldValue: Number(existing.cost) || 0,
        newValue: Number(row.cost) || 0,
      });
      infoChanged = true;
    }
    const oldUnit = String(existing.unit || '').trim();
    const newUnit = String(row.unit || '').trim();
    if (newUnit && oldUnit !== newUnit) {
      diffs.push({
        field: 'unit',
        label: 'ĐVT',
        oldValue: oldUnit,
        newValue: newUnit,
      });
      infoChanged = true;
    }
    const oldCat = String(existing.category || '').trim();
    const newCat = String(row.category || '').trim();
    if (newCat && oldCat !== newCat) {
      diffs.push({
        field: 'category',
        label: 'Danh mục',
        oldValue: oldCat,
        newValue: newCat,
      });
      infoChanged = true;
    }
    if (numbersDiffer(existing.stock, row.stock)) {
      diffs.push({
        field: 'stock',
        label: 'Tồn kho',
        oldValue: Number(existing.stock) || 0,
        newValue: Number(row.stock) || 0,
      });
      stockChanged = true;
    }

    let diffStatus: ProductImportDiffStatus;
    let recommendedAction: ProductImportAction;

    if (diffs.length === 0) {
      diffStatus = 'identical';
      recommendedAction = 'skip';
    } else if (infoChanged && !stockChanged) {
      diffStatus = 'info_changed';
      recommendedAction = 'update_info';
    } else if (!infoChanged && stockChanged) {
      diffStatus = 'stock_changed';
      recommendedAction = 'overwrite';
    } else {
      diffStatus = 'both_changed';
      recommendedAction = 'overwrite';
    }

    rows.push({
      ...row,
      id,
      isDuplicate: true,
      existingProduct: existing,
      diffStatus,
      diffs,
      recommendedAction,
      action: recommendedAction,
    });
  }

  const missingFromFile: MissingCatalogProductItem[] = [];
  for (const prod of existingProducts || []) {
    const key = normalizeProductNameKey(prod.name);
    if (!aggregatedMap.has(key)) {
      missingFromFile.push({
        product: prod,
        action: 'keep',
      });
    }
  }

  return { rows, missingFromFile };
}

/**
 * Convert reviewed product import rows and missing-catalog selections
 * into an atomic batch execution plan.
 */
export function buildProductImportPlan(
  rows: AnalyzedProductImportRow[],
  missingFromFile: MissingCatalogProductItem[] = []
): {
  newProducts: Omit<Product, 'id'>[];
  productUpdates: Array<{ id: string; data: Partial<Product> }>;
  productIdsToDelete: string[];
  counts: { created: number; updated: number; skipped: number; deleted: number };
} {
  const newProductsMap = new Map<string, Omit<Product, 'id'>>();
  const updateMap = new Map<string, Partial<Product>>();
  let skipped = 0;

  for (const row of rows || []) {
    if (row.action === 'skip') {
      skipped++;
      continue;
    }

    if (!row.existingProduct || row.action === 'create') {
      const key = normalizeProductNameKey(row.name);
      const prevNew = newProductsMap.get(key);
      if (prevNew) {
        newProductsMap.set(key, {
          ...prevNew,
          stock: (Number(prevNew.stock) || 0) + (Number(row.stock) || 0),
          price: Number(row.price) > 0 ? Number(row.price) : prevNew.price,
          cost: Number(row.cost) > 0 ? Number(row.cost) : prevNew.cost,
          unit: row.unit || prevNew.unit,
          category: row.category || prevNew.category,
        });
      } else {
        newProductsMap.set(key, {
          name: row.name,
          category: row.category || 'Đồ tự làm',
          unit: row.unit || 'Gói 500g',
          cost: Number(row.cost) || 0,
          price: Number(row.price) || 0,
          stock: Number(row.stock) || 0,
          image: row.image || '🌭',
        });
      }
      continue;
    }

    const existing = row.existingProduct;
    if (row.action === 'update_info') {
      updateMap.set(existing.id, {
        name: row.name || existing.name,
        category: row.category || existing.category,
        unit: row.unit || existing.unit,
        cost: Number(row.cost) > 0 ? Number(row.cost) : existing.cost,
        price: Number(row.price) > 0 ? Number(row.price) : existing.price,
        stock: existing.stock,
      });
    } else if (row.action === 'overwrite') {
      updateMap.set(existing.id, {
        name: row.name || existing.name,
        category: row.category || existing.category,
        unit: row.unit || existing.unit,
        cost: Number(row.cost) > 0 ? Number(row.cost) : existing.cost,
        price: Number(row.price) > 0 ? Number(row.price) : existing.price,
        stock: Number(row.stock) || 0,
      });
    } else if (row.action === 'accumulate') {
      const prevPending = updateMap.get(existing.id);
      const baseStock =
        prevPending && typeof prevPending.stock === 'number'
          ? prevPending.stock
          : Number(existing.stock) || 0;
      updateMap.set(existing.id, {
        name: existing.name || row.name,
        category: existing.category || row.category,
        unit: existing.unit || row.unit,
        cost: Number(existing.cost) > 0 ? existing.cost : Number(row.cost) || 0,
        price: Number(existing.price) > 0 ? existing.price : Number(row.price) || 0,
        stock: baseStock + (Number(row.stock) || 0),
      });
    }
  }

  const newProducts = Array.from(newProductsMap.values());
  const productUpdates = Array.from(updateMap.entries()).map(([id, data]) => ({ id, data }));
  const productIdsToDelete = (missingFromFile || [])
    .filter(item => item.action === 'delete' && item.product?.id)
    .map(item => item.product.id);

  return {
    newProducts,
    productUpdates,
    productIdsToDelete,
    counts: {
      created: newProducts.length,
      updated: productUpdates.length,
      skipped,
      deleted: productIdsToDelete.length,
    },
  };
}

// ============================================================================
// 2. CUSTOMER EXCEL IMPORT RECONCILIATION
// ============================================================================

export type CustomerImportDiffStatus =
  | 'new'
  | 'identical'
  | 'enrich_contact'
  | 'conflict';

export type CustomerImportMatchType = 'none' | 'phone' | 'name_only';

export type CustomerImportAction =
  | 'create'
  | 'merge_info'
  | 'overwrite'
  | 'accumulate'
  | 'skip';

export interface AnalyzedCustomerImportRow {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  extraAddresses?: string[];
  debt: number;
  isDuplicate: boolean;
  matchType: CustomerImportMatchType;
  existingCustomer?: Customer;
  diffStatus: CustomerImportDiffStatus;
  diffs: ImportFieldDiff[];
  recommendedAction: CustomerImportAction;
  action: CustomerImportAction;
}

function collectNormalizedPhones(phone?: string, phone2?: string): string[] {
  const tokens: string[] = [];
  const pushFrom = (raw?: string) => {
    if (!raw) return;
    const norm = normalizeVietnamesePhone(raw);
    if (!norm) return;
    for (const part of norm.split(' / ').map(p => p.trim()).filter(Boolean)) {
      if (!tokens.includes(part)) tokens.push(part);
    }
  };
  pushFrom(phone);
  pushFrom(phone2);
  return tokens;
}

function collectAllNormalizedAddresses(address?: string, extraAddresses?: string[]): string[] {
  const norm = normalizeAddressList(address || '', extraAddresses);
  const all = [norm.address, ...(norm.extraAddresses || [])].filter(Boolean);
  return all;
}

function normalizeCustomerNameKey(name: string): string {
  return removeVietnameseTones(String(name || '')).trim().toLowerCase();
}

export interface CustomerImportIndex {
  byPhone: Map<string, { customer: Customer; idx: number }>;
  byName: Map<string, Customer>;
}

/**
 * Build O(1) phone & normalized-name lookup indexes for fast batch customer reconciliation
 * without changing first-match semantics on 3,000+ directory records.
 */
export function buildCustomerImportIndex(existingCustomers: Customer[]): CustomerImportIndex {
  const byPhone = new Map<string, { customer: Customer; idx: number }>();
  const byName = new Map<string, Customer>();

  (existingCustomers || []).forEach((c, idx) => {
    const phones = collectNormalizedPhones(c.phone, c.phone2);
    for (const p of phones) {
      if (p && !byPhone.has(p)) {
        byPhone.set(p, { customer: c, idx });
      }
    }
    const nameKey = normalizeCustomerNameKey(c.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, c);
    }
  });

  return { byPhone, byName };
}

/**
 * Re-evaluate a single customer row against existing directory (used both in batch analysis
 * and after inline cell edits inside the preview modal).
 */
export function classifySingleCustomerImportRow(
  rawRow: Omit<
    ParsedCustomerRow,
    never
  > & { id: string },
  existingCustomers: Customer[],
  index?: CustomerImportIndex
): AnalyzedCustomerImportRow {
  let normPPhone = normalizeVietnamesePhone(rawRow.phone || '');
  let normPPhone2 = rawRow.phone2 ? normalizeVietnamesePhone(rawRow.phone2) : undefined;

  if (normPPhone && normPPhone.includes(' / ') && !normPPhone2) {
    const parts = normPPhone.split(' / ').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      normPPhone = parts[0];
      normPPhone2 = parts.slice(1).join(' / ');
    }
  }

  const normAddr = normalizeAddressList(rawRow.address || '', rawRow.extraAddresses);
  const rowDebt = Number(rawRow.debt) || 0;
  const rowName = String(rawRow.name || '').trim();

  // Primary match: normalized phone across phone & phone2
  let matchType: CustomerImportMatchType = 'none';
  let existing: Customer | undefined;

  if (normPPhone || normPPhone2) {
    if (index) {
      const incomingTokens = collectNormalizedPhones(normPPhone, normPPhone2);
      let bestIdx = Infinity;
      for (const tok of incomingTokens) {
        const hit = index.byPhone.get(tok);
        if (hit && hit.idx < bestIdx) {
          bestIdx = hit.idx;
          existing = hit.customer;
        }
      }
    } else {
      existing = (existingCustomers || []).find(c => {
        const p1Match =
          !!normPPhone &&
          ((c.phone && isPhoneMatching(c.phone, normPPhone)) ||
            (c.phone2 && isPhoneMatching(c.phone2, normPPhone)));
        const p2Match =
          !!normPPhone2 &&
          ((c.phone && isPhoneMatching(c.phone, normPPhone2)) ||
            (c.phone2 && isPhoneMatching(c.phone2, normPPhone2)));
        return p1Match || p2Match;
      });
    }
    if (existing) matchType = 'phone';
  }

  // Secondary match: exact tone-insensitive name when phone did not match
  if (!existing && rowName) {
    const targetNameKey = normalizeCustomerNameKey(rowName);
    if (index) {
      existing = index.byName.get(targetNameKey);
    } else {
      existing = (existingCustomers || []).find(
        c => normalizeCustomerNameKey(c.name) === targetNameKey
      );
    }
    if (existing) matchType = 'name_only';
  }

  if (!existing || matchType === 'none') {
    return {
      id: rawRow.id,
      name: rowName,
      phone: normPPhone,
      phone2: normPPhone2,
      address: normAddr.address,
      extraAddresses: normAddr.extraAddresses,
      debt: rowDebt,
      isDuplicate: false,
      matchType: 'none',
      diffStatus: 'new',
      diffs: [],
      recommendedAction: 'create',
      action: 'create',
    };
  }

  const diffs: ImportFieldDiff[] = [];

  if (matchType === 'name_only') {
    if (
      rowName &&
      rowName !== String(existing.name || '').trim() &&
      hasVietnameseDiacritics(rowName) &&
      !hasVietnameseDiacritics(existing.name || '')
    ) {
      diffs.push({
        field: 'name',
        label: 'Tên (bổ sung dấu)',
        oldValue: existing.name,
        newValue: rowName,
      });
    }
    if (normPPhone && normPPhone !== normalizeVietnamesePhone(existing.phone || '')) {
      diffs.push({
        field: 'phone',
        label: 'SĐT (Trùng tên)',
        oldValue: existing.phone || '(Trống)',
        newValue: normPPhone,
      });
    }
    if (normPPhone2 && normPPhone2 !== normalizeVietnamesePhone(existing.phone2 || '')) {
      diffs.push({
        field: 'phone2',
        label: 'SĐT 2',
        oldValue: existing.phone2 || '(Trống)',
        newValue: normPPhone2,
      });
    }
    const existingAddrs = collectAllNormalizedAddresses(existing.address, existing.extraAddresses).map(a =>
      removeVietnameseTones(a).toLowerCase()
    );
    const incomingAddrs = collectAllNormalizedAddresses(normAddr.address, normAddr.extraAddresses);
    const unseenAddrs = incomingAddrs.filter(
      a => !existingAddrs.includes(removeVietnameseTones(a).toLowerCase())
    );
    if (unseenAddrs.length > 0) {
      diffs.push({
        field: 'address',
        label: 'Địa chỉ',
        oldValue: existing.address || '(Trống)',
        newValue: unseenAddrs.join(' | '),
      });
    }
    if (numbersDiffer(existing.debt, rowDebt)) {
      diffs.push({
        field: 'debt',
        label: 'Công nợ',
        oldValue: Number(existing.debt) || 0,
        newValue: rowDebt,
      });
    }

    if (diffs.length === 0) {
      return {
        id: rawRow.id,
        name: rowName,
        phone: normPPhone,
        phone2: normPPhone2,
        address: normAddr.address,
        extraAddresses: normAddr.extraAddresses,
        debt: rowDebt,
        isDuplicate: true,
        matchType: 'name_only',
        existingCustomer: existing,
        diffStatus: 'identical',
        diffs: [],
        recommendedAction: 'skip',
        action: 'skip',
      };
    }

    const canSafelyMerge = !normPPhone || !existing.phone;
    const recommendedAction: CustomerImportAction = canSafelyMerge ? 'merge_info' : 'skip';

    return {
      id: rawRow.id,
      name: rowName,
      phone: normPPhone,
      phone2: normPPhone2,
      address: normAddr.address,
      extraAddresses: normAddr.extraAddresses,
      debt: rowDebt,
      isDuplicate: true,
      matchType: 'name_only',
      existingCustomer: existing,
      diffStatus: 'conflict',
      diffs,
      recommendedAction,
      action: recommendedAction,
    };
  }

  // Phone match inspection
  const existingPhoneList = collectNormalizedPhones(existing.phone, existing.phone2);
  const incomingPhoneList = collectNormalizedPhones(normPPhone, normPPhone2);
  const newPhones = incomingPhoneList.filter(p => !existingPhoneList.some(ep => isPhoneMatching(ep, p)));

  if (newPhones.length > 0) {
    diffs.push({
      field: 'phone2',
      label: '+SĐT mới',
      oldValue: existing.phone2 || existing.phone || '(Trống)',
      newValue: newPhones.join(' / '),
    });
  }

  const existingAddrKeys = collectAllNormalizedAddresses(existing.address, existing.extraAddresses).map(a =>
    removeVietnameseTones(a).trim().toLowerCase()
  );
  const incomingAddrs = collectAllNormalizedAddresses(normAddr.address, normAddr.extraAddresses);
  const newAddrs = incomingAddrs.filter(
    a => !existingAddrKeys.includes(removeVietnameseTones(a).trim().toLowerCase())
  );

  if (newAddrs.length > 0) {
    diffs.push({
      field: 'extraAddresses',
      label: '+Địa chỉ mới',
      oldValue: existing.address || '(Trống)',
      newValue: newAddrs.join(' | '),
    });
  }

  let hasConflictingName = false;
  let hasDiacriticUpgrade = false;
  if (rowName && rowName !== String(existing.name || '').trim()) {
    const oldKey = normalizeCustomerNameKey(existing.name);
    const newKey = normalizeCustomerNameKey(rowName);
    if (oldKey === newKey) {
      if (hasVietnameseDiacritics(rowName) && !hasVietnameseDiacritics(existing.name || '')) {
        hasDiacriticUpgrade = true;
        diffs.push({
          field: 'name',
          label: 'Tên (bổ sung dấu)',
          oldValue: existing.name,
          newValue: rowName,
        });
      }
    } else {
      hasConflictingName = true;
      diffs.push({
        field: 'name',
        label: 'Tên KH',
        oldValue: existing.name,
        newValue: rowName,
      });
    }
  }

  const existingDebt = Number(existing.debt) || 0;
  const debtDiffers = numbersDiffer(existingDebt, rowDebt);
  if (debtDiffers) {
    diffs.push({
      field: 'debt',
      label: 'Công nợ',
      oldValue: existingDebt,
      newValue: rowDebt,
    });
  }

  const hasNewContactInfo = newPhones.length > 0 || newAddrs.length > 0 || hasDiacriticUpgrade;

  let diffStatus: CustomerImportDiffStatus;
  let recommendedAction: CustomerImportAction;

  if (diffs.length === 0) {
    diffStatus = 'identical';
    recommendedAction = 'skip';
  } else if (
    !hasConflictingName &&
    hasNewContactInfo &&
    (!debtDiffers || rowDebt === 0)
  ) {
    diffStatus = 'enrich_contact';
    recommendedAction = 'merge_info';
  } else {
    diffStatus = 'conflict';
    recommendedAction = 'overwrite';
  }

  return {
    id: rawRow.id,
    name: rowName,
    phone: normPPhone,
    phone2: normPPhone2,
    address: normAddr.address,
    extraAddresses: normAddr.extraAddresses,
    debt: rowDebt,
    isDuplicate: true,
    matchType: 'phone',
    existingCustomer: existing,
    diffStatus,
    diffs,
    recommendedAction,
    action: recommendedAction,
  };
}

/**
 * Analyze parsed customer Excel rows against existing customer directory:
 * - Classifies each row into `'new'`, `'identical'`, `'enrich_contact'`, or `'conflict'`
 * - Supports both phone matches (`phone`/`phone2`) and `name_only` collisions
 * - Defaults identical rows to `'skip'` so debt never doubles on re-import
 */
export function analyzeCustomerImportRows(
  parsedRows: Array<{
    name: string;
    phone: string;
    phone2?: string;
    address: string;
    extraAddresses?: string[];
    debt: number;
  }>,
  existingCustomers: Customer[],
  nowTs = Date.now()
): AnalyzedCustomerImportRow[] {
  const index = buildCustomerImportIndex(existingCustomers);
  return (parsedRows || []).map((row, idx) =>
    classifySingleCustomerImportRow(
      {
        ...row,
        id: `cust_row_${nowTs}_${idx}`,
      },
      existingCustomers,
      index
    )
  );
}

/**
 * Build atomic batch create/update plan for reviewed customer import rows.
 */
export function buildCustomerImportPlan(rows: AnalyzedCustomerImportRow[]): {
  newCustomers: Array<Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>>;
  customerUpdates: Array<{ id: string; data: Partial<Customer> }>;
  counts: { created: number; updated: number; skipped: number };
} {
  const newCustomersMap = new Map<string, Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>>();
  const phoneToNewKey = new Map<string, string>();
  const updateMap = new Map<string, Customer & Partial<Customer>>();
  let skipped = 0;

  (rows || []).forEach((row, idx) => {
    if (row.action === 'skip') {
      skipped++;
      return;
    }

    if (row.action === 'create' || !row.existingCustomer) {
      // Group new customers ONLY by matching normalized phone (ADR-0015 invariant)
      const normPhone = row.phone ? normalizeVietnamesePhone(row.phone) : '';
      let targetKey: string | null = null;
      if (normPhone) {
        for (const [existingPhone, key] of phoneToNewKey.entries()) {
          if (isPhoneMatching(existingPhone, normPhone)) {
            targetKey = key;
            break;
          }
        }
      }

      if (targetKey && newCustomersMap.has(targetKey)) {
        const existingNew = newCustomersMap.get(targetKey)!;
        const mergedAddr = normalizeAddressList(
          existingNew.address || row.address,
          [
            ...(existingNew.extraAddresses || []),
            ...(row.extraAddresses || []),
            ...(existingNew.address && row.address ? [row.address] : []),
          ]
        );
        const mergedPhone = existingNew.phone || normPhone;
        const mergedPhone2 =
          existingNew.phone2 ||
          (row.phone2 && (!mergedPhone || !isPhoneMatching(mergedPhone, row.phone2))
            ? row.phone2
            : undefined);

        newCustomersMap.set(targetKey, {
          ...existingNew,
          phone: mergedPhone,
          phone2: mergedPhone2,
          address: mergedAddr.address,
          extraAddresses: mergedAddr.extraAddresses,
          debt: (Number(existingNew.debt) || 0) + (Number(row.debt) || 0),
        });
        if (mergedPhone) phoneToNewKey.set(mergedPhone, targetKey);
      } else {
        const key = `new_cust_${idx}`;
        const normAddr = normalizeAddressList(row.address, row.extraAddresses);
        newCustomersMap.set(key, {
          name: row.name,
          phone: normPhone,
          phone2: row.phone2,
          address: normAddr.address,
          extraAddresses: normAddr.extraAddresses,
          debt: Number(row.debt) || 0,
        });
        if (normPhone) phoneToNewKey.set(normPhone, key);
      }
      return;
    }

    const base = updateMap.get(row.existingCustomer.id) || row.existingCustomer;

    if (row.action === 'overwrite') {
      const normAddr = normalizeAddressList(
        row.address || base.address,
        row.extraAddresses || base.extraAddresses
      );
      updateMap.set(row.existingCustomer.id, {
        ...base,
        name: row.name || base.name,
        phone: row.phone || base.phone,
        phone2: row.phone2 ?? base.phone2,
        address: normAddr.address,
        extraAddresses: normAddr.extraAddresses,
        debt: Number(row.debt) || 0,
      });
    } else {
      // 'merge_info' (preserve debt) OR 'accumulate' (merge info + add debt)
      const existingPhones = collectNormalizedPhones(base.phone, base.phone2);
      const rowPhones = collectNormalizedPhones(row.phone, row.phone2);
      const nextPhone = base.phone || rowPhones[0] || '';
      const extraPhones = [...existingPhones, ...rowPhones].filter(
        p => p && (!nextPhone || !isPhoneMatching(nextPhone, p))
      );
      const dedupedExtraPhones: string[] = [];
      for (const ep of extraPhones) {
        if (!dedupedExtraPhones.some(x => isPhoneMatching(x, ep))) {
          dedupedExtraPhones.push(ep);
        }
      }
      const nextPhone2 = dedupedExtraPhones.length > 0 ? dedupedExtraPhones.join(' / ') : undefined;

      const normAddr = normalizeAddressList(
        base.address || row.address,
        [
          ...(base.extraAddresses || []),
          ...(row.extraAddresses || []),
          ...(base.address && row.address ? [row.address] : []),
        ]
      );

      let nextName = base.name || row.name;
      if (
        row.name &&
        normalizeCustomerNameKey(row.name) === normalizeCustomerNameKey(nextName) &&
        hasVietnameseDiacritics(row.name) &&
        !hasVietnameseDiacritics(nextName)
      ) {
        nextName = row.name;
      }

      const nextDebt =
        row.action === 'accumulate'
          ? (Number(base.debt) || 0) + (Number(row.debt) || 0)
          : Number(base.debt) || 0;

      updateMap.set(row.existingCustomer.id, {
        ...base,
        name: nextName,
        phone: nextPhone,
        phone2: nextPhone2,
        address: normAddr.address,
        extraAddresses: normAddr.extraAddresses,
        debt: nextDebt,
      });
    }
  });

  const newCustomers = Array.from(newCustomersMap.values());
  const customerUpdates = Array.from(updateMap.entries()).map(([id, full]) => ({
    id,
    data: {
      name: full.name,
      phone: full.phone,
      phone2: full.phone2,
      address: full.address,
      extraAddresses: full.extraAddresses,
      debt: full.debt,
    } as Partial<Customer>,
  }));

  return {
    newCustomers,
    customerUpdates,
    counts: {
      created: newCustomers.length,
      updated: customerUpdates.length,
      skipped,
    },
  };
}

// ============================================================================
// 3. ORDER EXCEL IMPORT RECONCILIATION
// ============================================================================

export type OrderImportDiffStatus = 'new' | 'identical' | 'conflict';
export type OrderImportAction = 'create' | 'overwrite' | 'skip';

export interface AnalyzedOrderImportRow {
  order: Order;
  existingOrder?: Order;
  diffStatus: OrderImportDiffStatus;
  diffs: ImportFieldDiff[];
  recommendedAction: OrderImportAction;
  action: OrderImportAction;
}

/**
 * Analyze parsed Order rows against existing orders before restoring:
 * - New order IDs -> `'new'` / `'create'`
 * - Matching IDs with zero diffs -> `'identical'` / `'skip'`
 * - Matching IDs with differing total/status/paid/debt/customer/item count -> `'conflict'` / `'overwrite'`
 */
export function analyzeOrderImportRows(
  parsedOrders: Order[],
  existingOrders: Order[],
  existingProducts: Product[]
): {
  rows: AnalyzedOrderImportRow[];
  missingProductsCount: number;
} {
  const existingMap = new Map<string, Order>();
  for (const ord of existingOrders || []) {
    if (ord?.id) existingMap.set(ord.id.trim(), ord);
  }

  const rows: AnalyzedOrderImportRow[] = (parsedOrders || []).map(ord => {
    const cleanId = String(ord?.id || '').trim();
    const existing = existingMap.get(cleanId);

    if (!existing) {
      return {
        order: ord,
        diffStatus: 'new',
        diffs: [],
        recommendedAction: 'create',
        action: 'create',
      };
    }

    const diffs: ImportFieldDiff[] = [];
    if (numbersDiffer(existing.total, ord.total)) {
      diffs.push({
        field: 'total',
        label: 'Tổng tiền',
        oldValue: Number(existing.total) || 0,
        newValue: Number(ord.total) || 0,
      });
    }
    if (existing.status !== ord.status) {
      diffs.push({
        field: 'status',
        label: 'Trạng thái',
        oldValue: existing.status,
        newValue: ord.status,
      });
    }
    if (numbersDiffer(existing.paidAmount, ord.paidAmount)) {
      diffs.push({
        field: 'paidAmount',
        label: 'Đã thu',
        oldValue: Number(existing.paidAmount) || 0,
        newValue: Number(ord.paidAmount) || 0,
      });
    }
    if (numbersDiffer(existing.debtAmount, ord.debtAmount)) {
      diffs.push({
        field: 'debtAmount',
        label: 'Ghi nợ',
        oldValue: Number(existing.debtAmount) || 0,
        newValue: Number(ord.debtAmount) || 0,
      });
    }
    const oldCustName = String(existing.customerName || '').trim();
    const newCustName = String(ord.customerName || '').trim();
    if (oldCustName !== newCustName) {
      diffs.push({
        field: 'customerName',
        label: 'Khách hàng',
        oldValue: oldCustName,
        newValue: newCustName,
      });
    }
    const oldItemCount = Array.isArray(existing.items) ? existing.items.length : 0;
    const newItemCount = Array.isArray(ord.items) ? ord.items.length : 0;
    if (oldItemCount !== newItemCount) {
      diffs.push({
        field: 'itemsCount',
        label: 'Số món',
        oldValue: oldItemCount,
        newValue: newItemCount,
      });
    }

    if (diffs.length === 0) {
      return {
        order: ord,
        existingOrder: existing,
        diffStatus: 'identical',
        diffs: [],
        recommendedAction: 'skip',
        action: 'skip',
      };
    }

    return {
      order: ord,
      existingOrder: existing,
      diffStatus: 'conflict',
      diffs,
      recommendedAction: 'overwrite',
      action: 'overwrite',
    };
  });

  const missingProductsCount = extractMissingProductsFromOrders(
    parsedOrders || [],
    existingProducts || []
  ).length;

  return {
    rows,
    missingProductsCount,
  };
}
