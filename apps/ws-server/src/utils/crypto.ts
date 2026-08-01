import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "../config/env.js";

// ---------------------------------------------------------------------------
// Symmetric encryption for secrets at rest (OAuth access/refresh tokens).
//
// AES-256-GCM with a random 12-byte IV per message. The stored value is
// "<ivHex>:<authTagHex>:<cipherHex>" so it is self-describing and safe to keep
// in a single text column. The key is derived from ENCRYPTION_KEY (or, as a
// fallback, NEXTAUTH_SECRET) via SHA-256 so any sufficiently long secret works.
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length
const KEY_LENGTH = 32; // 256-bit key

// Derives a stable 32-byte key from the configured secret.
function getKey(): Buffer {
  const secret = env.ENCRYPTION_KEY ?? env.NEXTAUTH_SECRET;
  return createHash("sha256").update(secret).digest().subarray(0, KEY_LENGTH);
}

// Encrypts a UTF-8 string, returning "iv:tag:ciphertext" in hex.
export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Reverses `encrypt`. Throws if the payload is malformed or tampered with.
export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
