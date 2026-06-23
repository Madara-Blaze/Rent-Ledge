import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Authenticated field encryption (AES-256-GCM) for PII at rest — PAN, Aadhaar,
 * bank details. Output is base64(iv ‖ authTag ‖ ciphertext). The 32-byte AES key
 * is derived from FIELD_ENCRYPTION_KEY via SHA-256, so any sufficiently random
 * secret works (in production, supply a high-entropy value from a secrets store).
 */
const IV_LEN = 12;
const TAG_LEN = 16;

function keyOf(keyMaterial: string): Buffer {
  return createHash('sha256').update(keyMaterial, 'utf8').digest();
}

export function encryptField(plain: string, keyB64: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', keyOf(keyB64), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptField(payload: string, keyB64: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', keyOf(keyB64), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
