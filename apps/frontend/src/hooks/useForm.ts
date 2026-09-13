'use client';

import React from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  min?: number;
  max?: number;
  match?: string;
  custom?: (value: any, values: any) => boolean;
  message?: string;
}

export interface UseFormOptions<T extends Record<string, any> = Record<string, any>> {
  initialValues?: T;
  validationRules?: Record<string, ValidationRule[]>;
  onSubmit: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
}

/**
 * Custom hook for form validation and state management in TypeScript
 */
export const useForm = <T extends Record<string, any> = Record<string, any>>({
  initialValues = {} as T,
  validationRules = {},
  onSubmit,
  validateOnChange = false,
}: UseFormOptions<T>) => {
  const [values, setValues] = React.useState<T>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  const validateField = (name: string, value: any): string | null => {
    const rules = validationRules[name];
    if (!rules) return null;

    for (const rule of rules) {
      if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return rule.message || `${name} is required`;
      }
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        return rule.message || `${name} must be at least ${rule.minLength} characters`;
      }
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        return rule.message || `${name} must not exceed ${rule.maxLength} characters`;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return rule.message || `${name} is invalid`;
      }
      if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return rule.message || 'Please enter a valid email address';
      }
      if (rule.min && parseFloat(value) < rule.min) {
        return rule.message || `${name} must be at least ${rule.min}`;
      }
      if (rule.max && parseFloat(value) > rule.max) {
        return rule.message || `${name} must not exceed ${rule.max}`;
      }
      if (rule.match && value !== values[rule.match]) {
        return rule.message || `${name} must match ${rule.match}`;
      }
      if (rule.custom && !rule.custom(value, values)) {
        return rule.message || `${name} is invalid`;
      }
    }

    return null;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    Object.keys(validationRules).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);

    if (validateOnChange || touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error || '' }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors((prev) => ({ ...prev, [name]: error || '' }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    setTouched(Object.keys(validationRules).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      setIsDirty(false);
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsDirty(false);
    setIsSubmitting(false);
  };

  const setFieldValue = (name: string, value: any) => {
    handleChange(name, value);
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid: Object.keys(errors).length === 0,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setValues,
    validate,
  };
};

export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    required: true,
    message,
  }),
  minLength: (min: number, message?: string): ValidationRule => ({
    minLength: min,
    message: message || `Must be at least ${min} characters`,
  }),
  maxLength: (max: number, message?: string): ValidationRule => ({
    maxLength: max,
    message: message || `Must not exceed ${max} characters`,
  }),
  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    email: true,
    message,
  }),
  pattern: (regex: RegExp, message = 'Invalid format'): ValidationRule => ({
    pattern: regex,
    message,
  }),
  min: (min: number, message?: string): ValidationRule => ({
    min,
    message: message || `Must be at least ${min}`,
  }),
  max: (max: number, message?: string): ValidationRule => ({
    max,
    message: message || `Must not exceed ${max}`,
  }),
  match: (fieldName: string, message?: string): ValidationRule => ({
    match: fieldName,
    message: message || `Must match ${fieldName}`,
  }),
  custom: (validator: (val: any, all: any) => boolean, message?: string): ValidationRule => ({
    custom: validator,
    message,
  }),
};

export const commonValidations = {
  email: [
    validationRules.required('Email is required'),
    validationRules.email(),
  ],
  password: [
    validationRules.required('Password is required'),
    validationRules.minLength(8, 'Password must be at least 8 characters'),
    validationRules.pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
  ],
  name: [
    validationRules.required('Name is required'),
    validationRules.minLength(2, 'Name must be at least 2 characters'),
    validationRules.maxLength(100, 'Name must not exceed 100 characters'),
  ],
  url: [
    validationRules.pattern(
      /^https?:\/\/.+/,
      'Please enter a valid URL (https:// or http://)'
    ),
  ],
};
