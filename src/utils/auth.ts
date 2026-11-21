/**
 * ADR-0024 & ADR-0025: Store Authentication Gate & Session Management
 * Supports dual store roles (`mexucxich` Owner + `admin` Admin + Edge-created staff)
 * with Supabase Auth (`signInWithPassword`) and seamless pre-RLS config fallback.
 */

export const STORE_AUTH_CONFIG_ROW_ID = 'store_auth_config_v1';
export const ADMIN_AUTH_CONFIG_ROW_ID = 'store_admin_auth_v1';
export const LOCAL_AUTH_CONFIG_KEY = 'mxc_auth_config_v1';
export const LOCAL_ADMIN_AUTH_CONFIG_KEY = 'mxc_admin_auth_config_v1';
export const LOCAL_AUTH_SESSION_KEY = 'mxc_auth_session_v1';

export const DEFAULT_STORE_USERNAME = 'mexucxich';
export const DEFAULT_STORE_PASSWORD_PLAIN = 'mexucxich123';
export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD_PLAIN = 'admin2026';

export type StoreRole = 'admin' | 'owner' | 'staff';

export interface StoreAuthConfig {
  requireSignIn: boolean;
  username: string;
  passwordHash: string;
  salt: string;
  sessionTtlDays: number;
  updatedAt: string;
}

export interface StoreAuthSession {
  username: string;
  email?: string;
  role: StoreRole;
  authSource: 'supabase' | 'store_config';
  authenticatedAt: string;
  expiresAt: string;
  passwordHashSnapshot?: string;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(val: number, bits: number): number {
  return (val >>> bits) | (val << (32 - bits));
}

function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return Array.from(hash)
    .map(v => v.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Compute a deterministic, multi-round stretched SHA-256 hash synchronously
 * so verification works identically in both browser and Node unit tests.
 */
export function hashStorePassword(
  username: string,
  password: string,
  salt = 'mxc_salt_v1'
): string {
  const normalizedUser = String(username || '').trim().toLowerCase();
  let digest = sha256Hex(`${salt}:${normalizedUser}:${password}`);
  for (let round = 0; round < 256; round++) {
    digest = sha256Hex(`${digest}:${salt}:${round}`);
  }
  return `sha256_r256:${digest}`;
}

export function createDefaultStoreAuthConfig(): StoreAuthConfig {
  return {
    requireSignIn: true,
    username: DEFAULT_STORE_USERNAME,
    passwordHash: hashStorePassword(DEFAULT_STORE_USERNAME, DEFAULT_STORE_PASSWORD_PLAIN, 'mxc_salt_v1'),
    salt: 'mxc_salt_v1',
    sessionTtlDays: 30,
    updatedAt: '2026-11-22T00:00:00.000Z',
  };
}

export function createDefaultAdminAuthConfig(): StoreAuthConfig {
  return {
    requireSignIn: true,
    username: DEFAULT_ADMIN_USERNAME,
    passwordHash: hashStorePassword(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD_PLAIN, 'mxc_salt_v1'),
    salt: 'mxc_salt_v1',
    sessionTtlDays: 30,
    updatedAt: '2026-11-22T00:00:00.000Z',
  };
}

export function stripAuthEmailDomain(usernameOrEmail: string): string {
  return String(usernameOrEmail || '')
    .trim()
    .toLowerCase()
    .replace(/@mexucxich\.(pos|local)$/i, '');
}

/**
 * Normalize a short POS username into an email format compatible with Supabase `signInWithPassword`.
 * Resolves known aliases (`hang` -> `mexucxich@mexucxich.pos`, `tung` -> `admin@mexucxich.pos`).
 */
export function normalizeUsernameToEmail(usernameOrEmail: string): string {
  const clean = String(usernameOrEmail || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  if (clean === 'hang') return 'mexucxich@mexucxich.pos';
  if (clean === 'tung') return 'admin@mexucxich.pos';
  return `${clean}@mexucxich.pos`;
}

export function inferRoleFromUsernameOrMetadata(
  usernameOrEmail: string,
  appMetadataRole?: string
): StoreRole {
  if (appMetadataRole === 'admin' || appMetadataRole === 'owner' || appMetadataRole === 'staff') {
    return appMetadataRole;
  }
  const clean = stripAuthEmailDomain(usernameOrEmail);
  if (clean === 'admin' || clean === 'tung') return 'admin';
  if (clean === 'mexucxich' || clean === 'hang') return 'owner';
  return 'staff';
}

/**
 * Verify username + password against a StoreAuthConfig (`mexucxich` owner or `admin` admin).
 */
export function verifyStoreCredentials(
  inputUsername: string,
  inputPassword: string,
  config: StoreAuthConfig
): boolean {
  if (!config || !inputPassword) return false;
  const cleanUser = stripAuthEmailDomain(inputUsername);
  const expectedUser = stripAuthEmailDomain(config.username || '');

  const isOwnerMatch =
    (expectedUser === 'mexucxich' || expectedUser === 'hang') &&
    (cleanUser === 'mexucxich' || cleanUser === 'hang');
  const isAdminMatch =
    (expectedUser === 'admin' || expectedUser === 'tung') &&
    (cleanUser === 'admin' || cleanUser === 'tung');

  if (cleanUser !== expectedUser && !isOwnerMatch && !isAdminMatch) {
    return false;
  }

  const computedHash = hashStorePassword(config.username, inputPassword, config.salt || 'mxc_salt_v1');
  return computedHash === config.passwordHash;
}

export function createStoreAuthSession(
  configOrUser:
    | StoreAuthConfig
    | {
        username: string;
        email?: string;
        role: StoreRole;
        authSource?: 'supabase' | 'store_config';
        sessionTtlDays?: number;
        passwordHash?: string;
      },
  nowMs = Date.now()
): StoreAuthSession {
  const isCfg = 'passwordHash' in configOrUser && !('role' in configOrUser);
  const username = stripAuthEmailDomain(configOrUser.username);
  const role: StoreRole = isCfg
    ? inferRoleFromUsernameOrMetadata(username)
    : configOrUser.role;
  const ttlDays = Math.max(1, Number(configOrUser.sessionTtlDays) || 30);
  const expiresMs = nowMs + ttlDays * 24 * 60 * 60 * 1000;

  return {
    username,
    email: !isCfg && configOrUser.email ? configOrUser.email : normalizeUsernameToEmail(username),
    role,
    authSource: !isCfg && configOrUser.authSource ? configOrUser.authSource : 'store_config',
    authenticatedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    passwordHashSnapshot: 'passwordHash' in configOrUser ? configOrUser.passwordHash : undefined,
  };
}

export function isStoreSessionValid(
  session: StoreAuthSession | null | undefined,
  ownerConfig: StoreAuthConfig,
  adminConfigOrNow?: StoreAuthConfig | number,
  maybeNowMs?: number
): boolean {
  const adminConfig = typeof adminConfigOrNow === 'object' ? adminConfigOrNow : undefined;
  const nowMs =
    typeof adminConfigOrNow === 'number'
      ? adminConfigOrNow
      : typeof maybeNowMs === 'number'
      ? maybeNowMs
      : Date.now();

  if (!session || !ownerConfig) return false;
  const expiresMs = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return false;

  if (session.authSource === 'supabase') {
    return true;
  }

  const targetCfg =
    session.role === 'admin' && adminConfig ? adminConfig : ownerConfig;
  if (!session.passwordHashSnapshot) return false;
  return session.passwordHashSnapshot === targetCfg.passwordHash;
}
