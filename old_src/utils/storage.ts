// Storage utility - uses IndexedDB for large data, localStorage for small data
// 🔒 SECURITY: Added encryption support for sensitive data

import { encryptData, decryptData, secureSetItem, secureGetItem } from './encryption'

const DB_NAME = 'SchoolDataDB'
const DB_VERSION = 1
const STORE_NAME = 'schoolData'

// 🔒 Sensitive keys that should be encrypted
const SENSITIVE_KEYS = [
  'auth-user',
  'backups',
  'payments',
  'payment_records',
  'users_2fa',
  'teachers',
  'students',
  'grades',
  'attendance',
  'messages'
]

// Check if a key should be encrypted
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.some(sensitive => key.includes(sensitive))
}

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

// Save to IndexedDB
export async function saveToIndexedDB(key: string, data: any): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(data, key)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error('IndexedDB save failed:', e)
    throw e
  }
}

// Load from IndexedDB
export async function loadFromIndexedDB(key: string): Promise<any> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error('IndexedDB load failed:', e)
    return null
  }
}

// Check data size
function getDataSize(data: string): number {
  return new Blob([data]).size
}

// Smart save - uses IndexedDB for large data, localStorage for small
// 🔒 SECURITY: Encrypts sensitive data
export async function smartSave(key: string, data: any): Promise<boolean> {
  const dataStr = JSON.stringify(data)
  const sizeKB = getDataSize(dataStr) / 1024



  // 🔒 Check if this is sensitive data that should be encrypted
  const shouldEncrypt = isSensitiveKey(key)

  // Use IndexedDB for data > 100KB
  if (sizeKB > 100) {

    try {
      // 🔒 Encrypt before saving to IndexedDB if sensitive
      const dataToSave = shouldEncrypt ? encryptData(data) : data
      await saveToIndexedDB(key, dataToSave)
      // Also save markers in localStorage
      localStorage.setItem(key + '_source', 'indexeddb')
      if (shouldEncrypt) {
        localStorage.setItem(key + '_encrypted', 'true')
      }
      return true
    } catch (e) {
      console.error('IndexedDB save failed, trying localStorage:', e)
    }
  }

  // Use localStorage for small data

  try {
    // 🔒 Encrypt sensitive data before saving
    if (shouldEncrypt) {
      secureSetItem(key, data)
      localStorage.setItem(key + '_source', 'localstorage')
    } else {
      localStorage.setItem(key, dataStr)
      localStorage.setItem(key + '_source', 'localstorage')
    }
    return true
  } catch (e) {
    console.error('localStorage save failed:', e)
    return false
  }
}

// Smart load - checks both IndexedDB and localStorage
// 🔒 SECURITY: Decrypts sensitive data
export async function smartLoad(key: string): Promise<any> {
  // Check where data is stored
  const source = localStorage.getItem(key + '_source')

  if (source === 'indexeddb') {

    const data = await loadFromIndexedDB(key)
    
    // 🔒 Decrypt if sensitive data
    const isEncrypted = localStorage.getItem(key + '_encrypted') === 'true'
    if (isEncrypted && data) {
      try {
        return decryptData(data)
      } catch (e) {
        console.error('Decryption failed, returning raw data:', e)
        return data
      }
    }
    return data
  }

  // Default to localStorage

  
  // 🔒 Check if data is encrypted
  const isEncrypted = localStorage.getItem(key + '_encrypted') === 'true'
  if (isEncrypted) {
    return secureGetItem(key)
  }
  
  const item = localStorage.getItem(key)
  if (item) {
    try {
      return JSON.parse(item)
    } catch (e) {
      console.error('Failed to parse localStorage data:', e)
      return null
    }
  }
  
  return null
}

// Clear all storage
export async function clearAllStorage(): Promise<void> {
  localStorage.clear()
  
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
  } catch (e) {
    console.error('Failed to clear IndexedDB:', e)
  }
}

