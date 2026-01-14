/**
 * Token Encryption Utility
 * Veilig encrypten en decrypten van Microsoft OAuth tokens
 */

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';

if (!ENCRYPTION_KEY) {
  throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
}

/**
 * Encrypt een string (bijv. access token of refresh token)
 */
export function encryptToken(plainText: string): string {
  const encrypted = CryptoJS.AES.encrypt(plainText, ENCRYPTION_KEY);
  return encrypted.toString();
}

/**
 * Decrypt een string terug naar de originele token
 */
export function decryptToken(encryptedText: string): string {
  const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return decrypted.toString(CryptoJS.enc.Utf8);
}
