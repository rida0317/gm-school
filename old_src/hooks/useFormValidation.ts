// src/hooks/useFormValidation.ts - Form validation hook

import { useState, useCallback } from 'react'
import { 
  validateTeacher, 
  validateClass, 
  validateStudent, 
  validateInventoryItem,
  validateEmail,
  validatePassword,
  validateTextInput,
  formRateLimiter
} from '../utils/validation'

export interface FormValidationResult {
  isValid: boolean
  errors: string[]
  isDirty: boolean
  isSubmitting: boolean
}

export interface UseFormValidationOptions<T> {
  initialValues: T
  validate: (values: T) => { isValid: boolean; errors: string[] }
  onSubmit: (values: T) => Promise<void> | void
  validateOnChange?: boolean
  validateOnBlur?: boolean
  debounceMs?: number
}

export const useFormValidation = <T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  debounceMs = 300
}: UseFormValidationOptions<T>) => {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<string[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateForm = useCallback((formValues: T) => {
    const result = validate(formValues)
    setErrors(result.errors)
    return result
  }, [validate])

  const handleChange = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
    setIsDirty(true)
    
    if (validateOnChange) {
      // Debounced validation
      setTimeout(() => {
        validateForm({ ...values, [name]: value })
      }, debounceMs)
    }
  }, [values, validateOnChange, validateForm, debounceMs])

  const handleBlur = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    
    if (validateOnBlur) {
      validateForm(values)
    }
  }, [values, validateOnBlur, validateForm])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // Rate limiting check
    if (!formRateLimiter()) {
      setErrors(['Too many submission attempts. Please wait before trying again.'])
      return
    }

    const validationResult = validateForm(values)
    
    if (!validationResult.isValid) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(values)
      // Reset form on successful submission if needed
      // setValues(initialValues)
      // setErrors([])
      // setIsDirty(false)
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors(['An error occurred while submitting the form. Please try again.'])
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validateForm, onSubmit])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors([])
    setIsDirty(false)
    setTouched({})
  }, [initialValues])

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => [...prev, error])
  }, [])

  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  const getFieldError = useCallback((field: string) => {
    // This is a basic implementation - you might want to enhance it
    // to return specific field errors if your validation returns field-specific errors
    return errors.find(error => error.toLowerCase().includes(field.toLowerCase())) || ''
  }, [errors])

  const isValid = errors.length === 0 && isDirty

  return {
    values,
    errors,
    isDirty,
    isSubmitting,
    touched,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldError,
    clearErrors,
    getFieldError
  }
}

// Specific validation hooks for different forms

export const useTeacherFormValidation = (onSubmit: (teacher: any) => Promise<void> | void) => {
  return useFormValidation({
    initialValues: {
      name: '',
      maxHoursPerWeek: 20,
      subjects: [],
      levels: [],
      availability: {},
      isVacataire: false
    },
    validate: validateTeacher,
    onSubmit
  })
}

export const useClassFormValidation = (onSubmit: (schoolClass: any) => Promise<void> | void) => {
  return useFormValidation({
    initialValues: {
      name: '',
      level: '',
      subjects: [],
      roomId: ''
    },
    validate: validateClass,
    onSubmit
  })
}

export const useStudentFormValidation = (onSubmit: (student: any) => Promise<void> | void) => {
  return useFormValidation({
    initialValues: {
      name: '',
      classId: '',
      email: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      guardianName: '',
      guardianPhone: ''
    },
    validate: validateStudent,
    onSubmit
  })
}

export const useInventoryFormValidation = (onSubmit: (item: any) => Promise<void> | void) => {
  return useFormValidation({
    initialValues: {
      name: '',
      category: '',
      quantity: 0,
      minQuantity: 0,
      location: '',
      description: ''
    },
    validate: validateInventoryItem,
    onSubmit
  })
}

// Hook for login form validation
export const useLoginFormValidation = (onSubmit: (credentials: { email: string; password: string }) => Promise<void> | void) => {
  return useFormValidation({
    initialValues: {
      email: '',
      password: ''
    },
    validate: (values) => {
      const errors: string[] = []
      
      if (!validateEmail(values.email)) {
        errors.push('Please enter a valid email address')
      }
      
      if (!values.password || values.password.length < 6) {
        errors.push('Password must be at least 6 characters long')
      }
      
      return {
        isValid: errors.length === 0,
        errors
      }
    },
    onSubmit
  })
}

// Hook for signup form validation
export const useSignupFormValidation = (onSubmit: (userData: { email: string; password: string; name: string; confirmPassword?: string }) => Promise<void> | void) => {
  return useFormValidation({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validate: (values) => {
      const errors: string[] = []
      
      if (!values.name || values.name.trim().length === 0) {
        errors.push('Name is required')
      }
      
      if (!validateEmail(values.email)) {
        errors.push('Please enter a valid email address')
      }
      
      const passwordValidation = validatePassword(values.password)
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors)
      }
      
      if (values.password !== values.confirmPassword) {
        errors.push('Passwords do not match')
      }
      
      return {
        isValid: errors.length === 0,
        errors
      }
    },
    onSubmit
  })
}

export default useFormValidation

