import CryptoJS from "crypto-js";

/**
 * Symmetric encryption for courier API credentials at rest.
 *
 * The key comes from ENCRYPTION_KEY; it falls back to NEXTAUTH_SECRET so a
 * development install works out of the box. Rotating either value makes
 * previously stored ciphertext undecryptable — re-enter the credentials.
 */
function getKey(): string {
  const key = process.env.ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY (or NEXTAUTH_SECRET) must be set to store courier credentials"
    );
  }
  return key;
}

const PREFIX = "enc:v1:";

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  return PREFIX + CryptoJS.AES.encrypt(plain, getKey()).toString();
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  // Values written before encryption was introduced are returned as-is.
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const bytes = CryptoJS.AES.decrypt(stored.slice(PREFIX.length), getKey());
    return bytes.toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
}

/** Shows only the last 4 characters — safe to return to the browser. */
export function maskSecret(stored: string | null | undefined): string | null {
  const plain = decryptSecret(stored);
  if (!plain) return null;
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}
