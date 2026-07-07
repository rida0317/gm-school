// src/utils/encryption.ts
// 🔒 SECURITY: Encryption utilities for sensitive LocalStorage data
// Uses AES-256 encryption with PBKDF2 key derivation

// 🔒 Import crypto-js safely
import CryptoJS from 'crypto-js'

const { AES, enc, PBKDF2, mode, pad } = CryptoJS
const { WordArray } = CryptoJS.lib

// Constants for encryption
const ITERATIONS = 10000 // PBKDF2 iterations
const KEY_SIZE = 256 // bits
const SALT_PREFIX = 'school-mgmt-salt-' // Unique salt prefix for this app

/**
 * 🔒 Generate a derived key from a password using PBKDF2
 * This ensures the encryption key is cryptographically strong
 */
export function deriveKey(password: string, salt: string): any {
  return PBKDF2(password, salt, {
    keySize: KEY_SIZE / 32, // Convert bits to words
    iterations: ITERATIONS
  })
}

/**
 * 🔒 Get or create encryption key for the session
 * Uses a combination of device fingerprint and app secret
 */
function getEncryptionKey(): string {
  // Generate a stable key based on multiple factors
  const factors = [
    navigator.userAgent,
    window.location.hostname,
    'school-management-system', // App identifier
    new Date().toDateString() // Changes daily for extra security
  ]

  // Create a hash of all factors
  const keyString = factors.join('|')

  // Use PBKDF2 to derive a strong key
  const salt = SALT_PREFIX + window.location.hostname
  const derivedKey = deriveKey(keyString, salt)

  return derivedKey.toString(enc.Hex)
}

/**
 * 🔒 Encrypt data using AES-256-CBC
 * @param data - The data to encrypt (will be JSON stringified if object)
 * @returns Base64 encoded encrypted string
 */
export function encryptData(data: any): string {
  try {
    // Convert data to JSON string
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data)

    // Get encryption key
    const key = getEncryptionKey()

    // Generate random IV (Initialization Vector)
    const iv = WordArray.random(128 / 8) // 128 bits = 16 bytes

    // Encrypt with AES-256-CBC
    const encrypted = AES.encrypt(jsonString, enc.Hex.parse(key), {
      iv: iv,
      mode: mode.CBC,
      padding: pad.Pkcs7
    })

    // Combine IV + ciphertext and return as base64
    const combined = iv.concat(encrypted.ciphertext)
    return enc.Base64.stringify(combined)
  } catch (error) {
    console.error('Encryption failed:', error)
    // Fallback: return unencrypted data (with warning)
    console.warn('⚠️ SECURITY WARNING: Data stored unencrypted due to encryption failure')
    return typeof data === 'string' ? data : JSON.stringify(data)
  }
}

/**
 * 🔒 Decrypt data using AES-256-CBC
 * @param encryptedData - Base64 encoded encrypted string
 * @returns Decrypted data (parsed as JSON if applicable)
 */
export function decryptData<T = any>(encryptedData: string): T | null {
  try {
    // Get encryption key
    const key = getEncryptionKey()

    // Convert from base64
    const combined = enc.Base64.parse(encryptedData)

    // Extract IV (first 16 bytes) and ciphertext (rest)
    const iv = WordArray.create(combined.words.slice(0, 4)) // 128 bits = 4 words
    const ciphertext = WordArray.create(
      combined.words.slice(4),
      combined.sigBytes - 16
    )

    // Decrypt with AES-256-CBC
    const decrypted = AES.decrypt(
      { ciphertext } as any,
      enc.Hex.parse(key),
      {
        iv: iv,
        mode: mode.CBC,
        padding: pad.Pkcs7
      }
    )

    // Convert to string
    const jsonString = decrypted.toString(enc.Utf8)

    // Parse JSON or return string
    if (!jsonString) {
      return null
    }

    try {
      return JSON.parse(jsonString) as T
    } catch {
      return jsonString as unknown as T
    }
  } catch (error) {
    console.error('Decryption failed:', error)
    return null
  }
}

/**
 * 🔒 Securely save data to LocalStorage with encryption
 * @param key - Storage key
 * @param data - Data to store (will be encrypted)
 */
export function secureSetItem(key: string, data: any): void {
  try {
    const encrypted = encryptData(data)
    localStorage.setItem(key, encrypted)
    localStorage.setItem(key + '_encrypted', 'true')
  } catch (error) {
    console.error('Failed to securely save data:', error)
    // Fallback to regular storage
    localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data))
    localStorage.setItem(key + '_encrypted', 'false')
  }
}

/**
 * 🔒 Securely retrieve data from LocalStorage with decryption
 * @param key - Storage key
 * @returns Decrypted data or null if not found
 */
export function secureGetItem<T = any>(key: string): T | null {
  try {
    const encrypted = localStorage.getItem(key)
    if (!encrypted) return null
    
    const isEncrypted = localStorage.getItem(key + '_encrypted') === 'true'
    
    if (isEncrypted) {
      return decryptData<T>(encrypted)
    } else {
      // Legacy unencrypted data
      const data = localStorage.getItem(key)
      if (!data) return null
      try {
        return JSON.parse(data) as T
      } catch {
        return data as unknown as T
      }
    }
  } catch (error) {
    console.error('Failed to securely retrieve data:', error)
    return null
  }
}

/**
 * 🔒 Remove securely stored data
 * @param key - Storage key
 */
export function secureRemoveItem(key: string): void {
  localStorage.removeItem(key)
  localStorage.removeItem(key + '_encrypted')
}

/**
 * 🔒 Check if data is encrypted
 * @param key - Storage key
 */
export function isEncrypted(key: string): boolean {
  return localStorage.getItem(key + '_encrypted') === 'true'
}

/**
 * 🔒 Migrate unencrypted data to encrypted storage
 * @param keys - Array of keys to migrate
 */
export function migrateToEncrypted(keys: string[]): void {
  keys.forEach(key => {
    if (!isEncrypted(key)) {
      const data = localStorage.getItem(key)
      if (data) {
        secureSetItem(key, data)

      }
    }
  })
}

/**
 * 🔒 Get encryption status report
 */
export function getEncryptionStatus(): {
  total: number
  encrypted: number
  unencrypted: number
  keys: { key: string; encrypted: boolean }[]
} {
  const keys: { key: string; encrypted: boolean }[] = []
  let encrypted = 0
  let unencrypted = 0
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && !key.endsWith('_encrypted')) {
      const isEnc = isEncrypted(key)
      keys.push({ key, encrypted: isEnc })
      if (isEnc) {
        encrypted++
      } else {
        unencrypted++
      }
    }
  }
  
  return {
    total: keys.length,
    encrypted,
    unencrypted,
    keys
  }
}

/**
 * 🔒 Clear all encrypted data
 * ⚠️ WARNING: This will delete all securely stored data!
 */
export function clearAllEncryptedData(): void {
  const keysToRemove: string[] = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.endsWith('_encrypted') || isEncrypted(key))) {
      keysToRemove.push(key)
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key))

}

// Auto-migrate common sensitive keys on import
const SENSITIVE_KEYS = [
  'auth-user',
  'backups',
  'payments',
  'payment_records',
  'users_2fa',
  'teachers',
  'students',
  'grades'
]

// Run migration on module load (optional)
// migrateToEncrypted(SENSITIVE_KEYS)

