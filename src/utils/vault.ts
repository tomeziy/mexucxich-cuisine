import type { Product, Customer, Order, DebtPayment, ReceiptSettings } from '../types/index.ts';

export interface VaultSnapshot {
  timestamp: string;
  reason?: string;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  receiptSettings: ReceiptSettings;
}

export interface BackupMetadata {
  key: string;
  label: string;
  timestamp: string;
  productCount: number;
  orderCount: number;
  customerCount: number;
  isEmergency: boolean;
}

export const EMERGENCY_VAULT_KEY = 'mxc_emergency_vault';
export const DAILY_BACKUP_PREFIX = 'mxc_backup_daily_';

/**
 * Returns formatted daily key: mxc_backup_daily_YYYY-MM-DD
 */
export function getDailyBackupKey(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${DAILY_BACKUP_PREFIX}${yyyy}-${mm}-${dd}`;
}

/**
 * Prunes rolling daily backups older than maxDays (default 7 days)
 */
export function pruneDailyBackups(storage: Storage = localStorage, maxDays = 7): string[] {
  const removedKeys: string[] = [];
  try {
    const now = Date.now();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(DAILY_BACKUP_PREFIX)) {
        keys.push(k);
      }
    }

    for (const key of keys) {
      const datePart = key.replace(DAILY_BACKUP_PREFIX, '');
      const epoch = new Date(datePart).getTime();
      if (!isNaN(epoch) && now - epoch > maxAgeMs) {
        storage.removeItem(key);
        removedKeys.push(key);
      }
    }
  } catch (e) {
    console.error('pruneDailyBackups error:', e);
  }
  return removedKeys;
}

/**
 * Saves a vault snapshot to daily rolling key and optionally emergency vault.
 * Safeguard: Never overwrites a larger emergency vault with a smaller/empty dataset!
 */
export function saveVaultSnapshot(
  snapshot: VaultSnapshot,
  forceEmergency = false,
  storage: Storage = localStorage
): { savedDaily: boolean; savedEmergency: boolean } {
  let savedDaily = false;
  let savedEmergency = false;

  try {
    const serialized = JSON.stringify(snapshot);
    const dailyKey = getDailyBackupKey(new Date(snapshot.timestamp || Date.now()));
    storage.setItem(dailyKey, serialized);
    savedDaily = true;
    pruneDailyBackups(storage, 7);

    // Emergency vault logic
    let shouldUpdateEmergency = forceEmergency;
    if (!shouldUpdateEmergency) {
      const existingRaw = storage.getItem(EMERGENCY_VAULT_KEY);
      if (!existingRaw) {
        shouldUpdateEmergency = true;
      } else {
        try {
          const existing = JSON.parse(existingRaw);
          const existingProds = existing.products?.length || 0;
          const incomingProds = snapshot.products?.length || 0;
          // Only auto-update emergency vault if incoming dataset has at least as many products
          if (incomingProds >= existingProds) {
            shouldUpdateEmergency = true;
          }
        } catch {
          shouldUpdateEmergency = true;
        }
      }
    }

    if (shouldUpdateEmergency) {
      storage.setItem(EMERGENCY_VAULT_KEY, serialized);
      savedEmergency = true;
    }
  } catch (e) {
    console.error('saveVaultSnapshot error:', e);
  }

  return { savedDaily, savedEmergency };
}

/**
 * Loads available backups (daily rolling + emergency vault)
 */
export function listVaultBackups(storage: Storage = localStorage): BackupMetadata[] {
  const result: BackupMetadata[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;

      if (key === EMERGENCY_VAULT_KEY || key.startsWith(DAILY_BACKUP_PREFIX)) {
        try {
          const raw = storage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const isEmergency = key === EMERGENCY_VAULT_KEY;
          const label = isEmergency
            ? 'Hầm Cứu Hộ Khẩn Cấp (Emergency Vault)'
            : `Bản sao lưu ngày ${key.replace(DAILY_BACKUP_PREFIX, '')}`;

          result.push({
            key,
            label,
            timestamp: parsed.timestamp || '',
            productCount: Array.isArray(parsed.products) ? parsed.products.length : 0,
            orderCount: Array.isArray(parsed.orders) ? parsed.orders.length : 0,
            customerCount: Array.isArray(parsed.customers) ? parsed.customers.length : 0,
            isEmergency,
          });
        } catch {
          // ignore corrupted keys
        }
      }
    }
  } catch (e) {
    console.error('listVaultBackups error:', e);
  }

  // Sort: Emergency vault first, then newest daily descending
  return result.sort((a, b) => {
    if (a.isEmergency) return -1;
    if (b.isEmergency) return 1;
    return b.key.localeCompare(a.key);
  });
}

/**
 * Reads a specific snapshot by key (defaults to EMERGENCY_VAULT_KEY)
 */
export function loadVaultSnapshot(
  key = EMERGENCY_VAULT_KEY,
  storage: Storage = localStorage
): VaultSnapshot | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as VaultSnapshot;
  } catch (e) {
    console.error('loadVaultSnapshot error:', e);
    return null;
  }
}
