import crypto from 'crypto';

/**
 * Envelope encryption for third-party OAuth tokens at rest.
 *
 * A connected-account token grants access to a real person's social account.
 * Storing those in plaintext would mean a single database read compromises
 * every customer's accounts at once, so they are encrypted with AES-256-GCM
 * before they touch MongoDB.
 *
 * GCM (not CBC) because it is authenticated: a tampered ciphertext fails to
 * decrypt rather than silently yielding garbage that gets sent to a provider.
 *
 * This is also a legal requirement, not just good practice — India's DPDP Act
 * 2023 obliges a Data Fiduciary to apply reasonable security safeguards, and
 * GDPR Art. 32 requires encryption of personal data where appropriate.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, the value GCM is defined for
const KEY_LENGTH = 32; // 256 bits
const VERSION = 'v1'; // lets the format change later without breaking old rows

let cachedKey: Buffer | null = null;

/**
 * Resolves the master key from TOKEN_ENCRYPTION_KEY.
 *
 * Deliberately throws rather than falling back to a default. A hardcoded
 * fallback key would be readable by anyone with the repository, which is
 * indistinguishable from storing the tokens in plaintext.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set. Connected-account tokens cannot be stored ' +
        'without it. Generate one with:  openssl rand -base64 32'
    );
  }

  // Accept base64 or hex so operators are not forced into one format.
  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). ` +
        'Generate one with:  openssl rand -base64 32'
    );
  }

  cachedKey = key;
  return key;
}

/** True when a usable encryption key is configured. */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a token. Output is `v1.<iv>.<authTag>.<ciphertext>`, all base64url.
 *
 * `aad` binds the ciphertext to a context (here: userId + provider), so a row
 * copied from one user to another fails authentication instead of decrypting.
 */
export function encryptToken(plaintext: string, aad?: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Decrypts a token produced by `encryptToken`.
 * Throws if the payload was tampered with or the AAD does not match.
 */
export function decryptToken(payload: string, aad?: string): string {
  const key = getKey();
  const parts = payload.split('.');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted token payload.');
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));

  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Cryptographically random string for OAuth `state` and PKCE verifiers. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** PKCE S256 challenge derived from a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Constant-time string comparison, for verifying OAuth `state` and the
 * Telegram login HMAC. A plain `===` leaks length and prefix information
 * through timing.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Last four characters of a token, for display.
 * Never render a full third-party token in a UI or a log.
 */
export function tokenHint(token: string): string {
  return token.length <= 4 ? '****' : `••••${token.slice(-4)}`;
}
