import type { Product, Customer, Order, DebtPayment } from '../types/index.ts';

/**
 * Tính toán bù trừ tồn kho (Delta Calculation) an toàn với sàn chặn 0
 * Tránh lỗi số âm và làm tròn tránh lỗi dấu phẩy động (float precision)
 */
export function calculateStockDelta(currentStock: number | string | null | undefined, delta: number | string | null | undefined): number {
  const stockNum = typeof currentStock === 'number' ? currentStock : parseFloat(String(currentStock || 0));
  const deltaNum = typeof delta === 'number' ? delta : parseFloat(String(delta || 0));

  const validStock = isNaN(stockNum) ? 0 : stockNum;
  const validDelta = isNaN(deltaNum) ? 0 : deltaNum;

  const result = Math.max(0, validStock + validDelta);
  // Làm tròn tối đa 4 chữ số thập phân cho trường hợp đơn vị lẻ (vd: 0.5kg)
  return Math.round(result * 10000) / 10000;
}

/**
 * Trích xuất timestamp epoch mili-giây từ thực thể
 * Ưu tiên updatedAt (thời điểm cập nhật gần nhất), sau đó là createdAt
 */
export function getEntityTimestamp(entity?: { updatedAt?: string; createdAt?: string } | null): number {
  if (!entity || typeof entity !== 'object') return 0;
  const timeStr = entity.updatedAt || entity.createdAt;
  if (!timeStr || typeof timeStr !== 'string') return 0;

  const epoch = new Date(timeStr).getTime();
  return isNaN(epoch) ? 0 : epoch;
}

export type ConflictResolutionSource = 'local' | 'cloud';

export interface ConflictResolutionResult<T> {
  winner: T;
  source: ConflictResolutionSource;
}

/**
 * Giải quyết xung đột cho 1 sản phẩm dựa trên timestamp
 * Nếu bản ghi cục bộ mới hơn bản ghi Cloud (localTime > cloudTime), bảo vệ bản ghi cục bộ
 */
export function resolveProductConflict(local: Product, cloud: Product): ConflictResolutionResult<Product> {
  const localTime = getEntityTimestamp(local);
  const cloudTime = getEntityTimestamp(cloud);

  if (localTime > cloudTime) {
    return { winner: local, source: 'local' };
  }
  return { winner: cloud, source: 'cloud' };
}

/**
 * Giải quyết xung đột cho 1 khách hàng dựa trên timestamp
 */
export function resolveCustomerConflict(local: Customer, cloud: Customer): ConflictResolutionResult<Customer> {
  const localTime = getEntityTimestamp(local);
  const cloudTime = getEntityTimestamp(cloud);

  if (localTime > cloudTime) {
    return { winner: local, source: 'local' };
  }
  return { winner: cloud, source: 'cloud' };
}

export interface MergeProductsResult {
  merged: Product[];
  localPreserved: Product[];
  cloudAccepted: Product[];
}

/**
 * Hợp nhất danh sách Sản phẩm giữa Cục bộ và Cloud
 * - Giữ lại các món mới tạo cục bộ chưa kịp đẩy lên Cloud
 * - Nhận các món mới trên Cloud
 * - So sánh timestamp cho các món trùng ID: bản ghi mới hơn sẽ thắng
 */
export function mergeProductsWithConflictResolution(
  localProducts: Product[],
  cloudProducts: Product[]
): MergeProductsResult {
  const localMap = new Map<string, Product>();
  for (const p of localProducts || []) {
    if (p && p.id) localMap.set(p.id, p);
  }

  const cloudMap = new Map<string, Product>();
  for (const p of cloudProducts || []) {
    if (p && p.id) cloudMap.set(p.id, p);
  }

  const merged: Product[] = [];
  const localPreserved: Product[] = [];
  const cloudAccepted: Product[] = [];
  const processedIds = new Set<string>();

  // 1. Duyệt qua toàn bộ sản phẩm từ Cloud
  for (const cloudP of cloudProducts || []) {
    if (!cloudP || !cloudP.id) continue;
    if (processedIds.has(cloudP.id)) continue;
    processedIds.add(cloudP.id);

    const localP = localMap.get(cloudP.id);
    if (localP) {
      const { winner, source } = resolveProductConflict(localP, cloudP);
      merged.push(winner);
      if (source === 'local') {
        localPreserved.push(winner);
      } else {
        cloudAccepted.push(winner);
      }
    } else {
      merged.push(cloudP);
      cloudAccepted.push(cloudP);
    }
  }

  // 2. Bảo toàn các sản phẩm cục bộ mới tạo chưa có trên Cloud
  for (const localP of localProducts || []) {
    if (localP && localP.id && !processedIds.has(localP.id)) {
      merged.push(localP);
      localPreserved.push(localP);
    }
  }

  return { merged, localPreserved, cloudAccepted };
}

export interface MergeCustomersResult {
  merged: Customer[];
  localPreserved: Customer[];
  cloudAccepted: Customer[];
}

/**
 * Hợp nhất danh sách Khách hàng giữa Cục bộ và Cloud
 * Bảo vệ các thay đổi SĐT, Địa chỉ, Dư nợ mới cập nhật trên quầy không bị Cloud cũ ghi đè
 */
export function mergeCustomersWithConflictResolution(
  localCustomers: Customer[],
  cloudCustomers: Customer[]
): MergeCustomersResult {
  const localMap = new Map<string, Customer>();
  for (const c of localCustomers || []) {
    if (c && c.id) localMap.set(c.id, c);
  }

  const merged: Customer[] = [];
  const localPreserved: Customer[] = [];
  const cloudAccepted: Customer[] = [];
  const processedIds = new Set<string>();

  for (const cloudC of cloudCustomers || []) {
    if (!cloudC || !cloudC.id) continue;
    if (processedIds.has(cloudC.id)) continue;
    processedIds.add(cloudC.id);

    const localC = localMap.get(cloudC.id);
    if (localC) {
      const { winner, source } = resolveCustomerConflict(localC, cloudC);
      merged.push(winner);
      if (source === 'local') {
        localPreserved.push(winner);
      } else {
        cloudAccepted.push(winner);
      }
    } else {
      merged.push(cloudC);
      cloudAccepted.push(cloudC);
    }
  }

  for (const localC of localCustomers || []) {
    if (localC && localC.id && !processedIds.has(localC.id)) {
      merged.push(localC);
      localPreserved.push(localC);
    }
  }

  return { merged, localPreserved, cloudAccepted };
}

/**
 * Hợp nhất danh sách Đơn hàng giữa Cục bộ và Cloud
 * Giữ nguyên các đơn mới tạo cục bộ và cập nhật đơn có timestamp mới hơn
 */
export function mergeOrders(localOrders: Order[], cloudOrders: Order[]): Order[] {
  const orderMap = new Map<string, Order>();

  for (const cloudO of cloudOrders || []) {
    if (cloudO && cloudO.id) {
      orderMap.set(cloudO.id, cloudO);
    }
  }

  for (const localO of localOrders || []) {
    if (!localO || !localO.id) continue;
    const existing = orderMap.get(localO.id);
    if (!existing) {
      orderMap.set(localO.id, localO);
    } else {
      const localTime = getEntityTimestamp(localO);
      const cloudTime = getEntityTimestamp(existing);
      if (localTime > cloudTime) {
        orderMap.set(localO.id, localO);
      }
    }
  }

  return Array.from(orderMap.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.createdAt || 0).getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Hợp nhất lịch sử Thu nợ giữa Cục bộ và Cloud
 * Giữ nguyên các phiếu mới tạo cục bộ và cập nhật phiếu có timestamp mới hơn
 */
export function mergeDebtPayments(localPayments: DebtPayment[], cloudPayments: DebtPayment[]): DebtPayment[] {
  const paymentMap = new Map<string, DebtPayment>();

  for (const cloudP of cloudPayments || []) {
    if (cloudP && cloudP.id) {
      paymentMap.set(cloudP.id, cloudP);
    }
  }

  for (const localP of localPayments || []) {
    if (!localP || !localP.id) continue;
    const existing = paymentMap.get(localP.id);
    if (!existing) {
      paymentMap.set(localP.id, localP);
    } else {
      const localTime = getEntityTimestamp(localP);
      const cloudTime = getEntityTimestamp(existing);
      if (localTime > cloudTime) {
        paymentMap.set(localP.id, localP);
      }
    }
  }

  return Array.from(paymentMap.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.createdAt || 0).getTime() || 0;
    return timeB - timeA;
  });
}
