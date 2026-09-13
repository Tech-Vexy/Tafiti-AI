// @ts-nocheck
import React from 'react';

const Spinner = React.forwardRef(({ size = 'md', className = '', ...props }, ref) => {
    const sizes = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12',
    };
    
    return (
        <div
            ref={ref}
            className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizes[size]} ${className}`}
            {...props}
        />
    );
});

Spinner.displayName = 'Spinner';

export default Spinner;
