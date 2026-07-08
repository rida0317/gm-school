// src/services/2fa.service.ts - Two-Factor Authentication service (Supabase Version)

import { supabase } from '../lib/supabaseClient'
import CryptoJS from 'crypto-js'

const { HmacSHA1, enc } = CryptoJS

export interface TwoFAConfig {
  user_id: string
  enabled: boolean
  secret?: string
  backup_codes?: string[]
  method: 'totp' | 'sms' | 'email'
  phone_number?: string
  email?: string
  created_at?: string
  last_used?: string
}

export interface TwoFAResult {
  success: boolean
  message: string
  qrCodeUrl?: string
  backupCodes?: string[]
  requiresVerification?: boolean
}

class TwoFAService {
  private generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let secret = ''
    const array = new Uint8Array(20)
    crypto.getRandomValues(array)
    for (let i = 0; i < 20; i++) {
      secret += chars.charAt(array[i] % chars.length)
    }
    return secret
  }

  private generateTOTP(secret: string, timestamp?: number): string {
    const timeStep = 30
    const timeCounter = timestamp !== undefined 
      ? Math.floor(timestamp / 1000 / timeStep)
      : Math.floor(Date.now() / 1000 / timeStep)
    
    const timeBytes = new Uint8Array(8)
    let tempTime = timeCounter
    for (let i = 7; i >= 0; i--) {
      timeBytes[i] = tempTime & 0xff
      tempTime = Math.floor(tempTime / 256)
    }
    
    const key = this.base32ToBytes(secret)
    const hmac = HmacSHA1(
      enc.Hex.parse(this.bytesToHex(timeBytes)), 
      enc.Hex.parse(this.bytesToHex(key))
    )
    const hmacBytes = enc.Hex.stringify(hmac)
    const offset = parseInt(hmacBytes.substring(hmacBytes.length - 1), 16)
    const binary = (parseInt(hmacBytes.substring(offset * 2, offset * 2 + 8), 16) & 0x7fffffff)
    return (binary % 1000000).toString().padStart(6, '0')
  }

  private base32ToBytes(base32: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = ''
    for (const char of base32.toUpperCase().replace(/=/g, '')) {
      const index = chars.indexOf(char)
      if (index === -1) continue
      bits += index.toString(2).padStart(5, '0')
    }
    const bytes = new Uint8Array(Math.ceil(bits.length / 8))
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2)
    }
    return bytes
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private verifyCode(code: string, secret: string): boolean {
    const currentTime = Date.now()
    const timeStep = 30 * 1000
    for (const offset of [-1, 0, 1]) {
      const testTime = currentTime + (offset * timeStep)
      const generatedCode = this.generateTOTP(secret, testTime)
      if (code === generatedCode) return true
    }
    return false
  }

  private generateQRCodeUrl(secret: string, email: string, schoolName: string): string {
    const issuer = encodeURIComponent(schoolName || 'School Management')
    const label = encodeURIComponent(email)
    return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = []
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for (let i = 0; i < count; i++) {
      const array = new Uint8Array(4)
      crypto.getRandomValues(array)
      let code = ''
      for (let j = 0; j < 4; j++) {
        code += chars.charAt(array[j] % chars.length)
      }
      codes.push(`${code.substring(0, 4)}-${code.substring(4)}`)
    }
    return codes
  }

  async enable2FA(userId: string, email: string, schoolName: string): Promise<TwoFAResult> {
    try {
      const secret = this.generateSecret()
      const backupCodes = this.generateBackupCodes()
      const qrCodeUrl = this.generateQRCodeUrl(secret, email, schoolName)

      const { error } = await supabase
        .from('user_2fa')
        .upsert({
          user_id: userId,
          enabled: false,
          secret,
          backup_codes: backupCodes,
          method: 'totp',
          created_at: new Date().toISOString()
        })

      if (error) throw error

      return {
        success: true,
        message: '2FA setup initiated. Please scan the QR code and verify.',
        qrCodeUrl,
        backupCodes,
        requiresVerification: true
      }
    } catch (error) {
      console.error('Error enabling 2FA:', error)
      return { success: false, message: 'Failed to enable 2FA' }
    }
  }

  async verify2FASetup(userId: string, code: string): Promise<TwoFAResult> {
    try {
      const { data: config, error } = await supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !config) return { success: false, message: '2FA configuration not found' }
      if (!config.secret) return { success: false, message: '2FA secret not found' }

      if (!this.verifyCode(code, config.secret)) {
        return { success: false, message: 'Invalid verification code.' }
      }

      await supabase
        .from('user_2fa')
        .update({ enabled: true, last_used: new Date().toISOString() })
        .eq('user_id', userId)

      return { success: true, message: '2FA activated successfully!' }
    } catch (error) {
      console.error('Error verifying 2FA:', error)
      return { success: false, message: 'Failed to verify 2FA' }
    }
  }

  async verify2FA(userId: string, code: string): Promise<TwoFAResult> {
    try {
      const { data: config, error } = await supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !config || !config.enabled) {
        return { success: false, message: '2FA not enabled or configured' }
      }

      if (config.backup_codes?.includes(code)) {
        const remainingCodes = config.backup_codes.filter((c: string) => c !== code)
        await supabase
          .from('user_2fa')
          .update({ backup_codes: remainingCodes, last_used: new Date().toISOString() })
          .eq('user_id', userId)
        return { success: true, message: 'Backup code accepted.' }
      }

      if (!config.secret || !this.verifyCode(code, config.secret)) {
        return { success: false, message: 'Invalid verification code' }
      }

      await supabase
        .from('user_2fa')
        .update({ last_used: new Date().toISOString() })
        .eq('user_id', userId)

      return { success: true, message: '2FA verified successfully' }
    } catch (error) {
      console.error('Error verifying 2FA:', error)
      return { success: false, message: 'Failed to verify 2FA' }
    }
  }

  async get2FAStatus(userId: string): Promise<{ enabled: boolean; method: string; lastUsed?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .select('enabled, method, last_used')
        .eq('user_id', userId)
        .single()

      if (error || !data) return { enabled: false, method: 'none' }
      return {
        enabled: data.enabled,
        method: data.method,
        lastUsed: data.last_used
      }
    } catch (error) {
      return { enabled: false, method: 'none' }
    }
  }
}

export const twoFAService = new TwoFAService()
export default twoFAService

