# Feature: Cross-device Sync & Deterministic DB

## Sub-features
- Deterministic pagination queries using `.order('id', { ascending: true })`.
- Client-side deduplication buffer (`seenIds = new Set<string>()`).
- Atomic stock delta calculations avoiding race condition overwrites.
- Timestamp-based conflict resolution on pull.

## How to get to it (user POV)
1. In Settings, connect to Supabase Cloud.
2. Click "Tải từ Cloud về" to sync thousands of products/customers.

## Driving it with Unit Tests
```bash
node scripts/test_sync_conflict.js
node scripts/test_adr0010.js
```

## Gotchas
- PostgreSQL pagination across chunks without `.order('id')` causes non-deterministic row shifts if items share identical `created_at`.
