'use client';

import React from 'react';

/**
 * Custom hook for form validation and state management
 */
export const useForm = ({ 
    initialValues = {}, 
    validationRules = {}, 
    onSubmit,
    validateOnChange = false 
}) => {
    const [values, setValues] = React.useState(initialValues);
    const [errors, setErrors] = React.useState({});
    const [touched, setTouched] = React.useState({});
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isDirty, setIsDirty] = React.useState(false);

    const validateField = (name, value) => {
        const rules = validationRules[name];
        if (!rules) return null;

        for (const rule of rules) {
            if (rule.required && (!value || value.trim() === '')) {
                return rule.message || `${name} is required`;
            }
            if (rule.minLength && value.length < rule.minLength) {
                return rule.message || `${name} must be at least ${rule.minLength} characters`;
            }
            if (rule.maxLength && value.length > rule.maxLength) {
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

    const validate = () => {
        const newErrors = {};
        let isValid = true;

        Object.keys(validationRules).forEach(name => {
            const error = validateField(name, values[name]);
            if (error) {
                newErrors[name] = error;
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    const handleChange = (name, value) => {
        setValues(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);

        if (validateOnChange || touched[name]) {
            const error = validateField(name, value);
            setErrors(prev => ({ ...prev, [name]: error }));
        }
    };

    const handleBlur = (name) => {
        setTouched(prev => ({ ...prev, [name]: true }));
        const error = validateField(name, values[name]);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();

        // Mark all fields as touched
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

    const setFieldValue = (name, value) => {
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

/**
 * Pre-defined validation rules
 */
export const validationRules = {
    required: (message = 'This field is required') => ({
        required: true,
        message,
    }),
    minLength: (min, message) => ({
        minLength: min,
        message: message || `Must be at least ${min} characters`,
    }),
    maxLength: (max, message) => ({
        maxLength: max,
        message: message || `Must not exceed ${max} characters`,
    }),
    email: (message = 'Please enter a valid email address') => ({
        email: true,
        message,
    }),
    pattern: (regex, message = 'Invalid format') => ({
        pattern: regex,
        message,
    }),
    min: (min, message) => ({
        min,
        message: message || `Must be at least ${min}`,
    }),
    max: (max, message) => ({
        max,
        message: message || `Must not exceed ${max}`,
    }),
    match: (fieldName, message) => ({
        match: fieldName,
        message: message || `Must match ${fieldName}`,
    }),
    custom: (validator, message) => ({
        custom: validator,
        message,
    }),
};

/**
 * Common validation rule sets
 */
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
