// src/utils/validation.ts
// 🔒 SECURITY: Enhanced validation utilities

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone: string): boolean => {
  // Moroccan phone format: +2126..., 06..., 07...
  // Simple check for 10 digits starting with 0 or +212
  const re = /^(?:(?:\+|00)212|0)[5-7]\d{8}$/;
  return re.test(phone.replace(/\s/g, ''));
};

// 🔒 SECURITY: Enhanced password validation with strength checking
export interface PasswordValidationResult {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  message?: string;
  errors: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
  };
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password)
  };

  // Check minimum length (8 characters)
  if (!requirements.minLength) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for uppercase letters
  if (!requirements.hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letters
  if (!requirements.hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (!requirements.hasNumber) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters - NOT ALLOWED
  if (/[!@#$%^&*(),.?":{}|<>_\-+=[\\]\\;'`~]/.test(password)) {
    errors.push('Password can only contain letters and numbers (no special characters)');
  }

  // Check for common passwords
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'monkey', 'letmein', 'dragon', 'admin', 'admin123',
    'welcome', 'login', 'passw0rd', 'shadow', 'sunshine', 'princess'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  // Check for repeated characters (e.g., "aaa", "111")
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain repeated characters');
  }

  // Check for sequential characters (e.g., "abc", "123")
  const sequentialPatterns = [
    'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk', 'jkl',
    'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst', 'stu', 'tuv',
    'uvw', 'vwx', 'wxy', 'xyz',
    '012', '123', '234', '345', '456', '567', '678', '789'
  ];

  const lowerPassword = password.toLowerCase();
  if (sequentialPatterns.some(pattern => lowerPassword.includes(pattern))) {
    errors.push('Password cannot contain sequential characters');
  }

  // Calculate password strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  const metRequirements = Object.values(requirements).filter(Boolean).length;

  if (metRequirements === 4 && password.length >= 12 && errors.length === 0) {
    strength = 'strong';
  } else if (metRequirements >= 3 && password.length >= 8 && errors.length === 0) {
    strength = 'medium';
  }

  // Generate message based on strength
  let message: string | undefined;
  if (errors.length === 0) {
    if (strength === 'strong') {
      message = '✅ Strong password';
    } else if (strength === 'medium') {
      message = '⚠️ Medium strength - consider adding more length';
    }
  } else {
    message = errors[0]; // Show first error
  }

  return {
    isValid: errors.length === 0,
    strength,
    message,
    errors,
    requirements
  };
};

// 🔒 SECURITY: Check if password has been compromised (using Have I Been Pwned API)
export async function checkPasswordBreached(password: string): Promise<{
  breached: boolean;
  count?: number;
  error?: string;
}> {
  try {
    // Hash password with SHA-1
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Get first 5 characters of hash
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // Query Have I Been Pwned API (k-anonymity model)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    
    if (!response.ok) {
      return { breached: false, error: 'Could not check password database' };
    }

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim().toUpperCase() === suffix) {
        return {
          breached: true,
          count: parseInt(count, 10)
        };
      }
    }

    return { breached: false };
  } catch (error) {
    console.error('Error checking password breach:', error);
    return { breached: false, error: 'Failed to check password database' };
  }
}

// 🔒 SECURITY: Password strength calculator (for UI feedback)
export const calculatePasswordStrength = (password: string): number => {
  let score = 0;

  // Length score (max 30 points)
  score += Math.min(password.length, 16) * 2;

  // Complexity score (max 40 points)
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;

  // Deductions
  // Repeated characters (max -20 points)
  const repeatedChars = password.match(/(.)\1{2,}/g);
  if (repeatedChars) {
    score -= repeatedChars.length * 10;
  }

  // Sequential characters (max -20 points)
  const sequentialChars = password.match(/(abc|bcd|cde|def|efg|012|123|234|345)/gi);
  if (sequentialChars) {
    score -= sequentialChars.length * 10;
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
};

