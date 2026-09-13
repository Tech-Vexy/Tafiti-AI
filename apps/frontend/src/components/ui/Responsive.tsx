// @ts-nocheck
import React from 'react';

/**
 * Responsive wrapper component that shows different content based on breakpoint
 */
export const Responsive = ({ 
    children, 
    xs, sm, md, lg, xl, '2xl': xxl, '3xl': xxxl 
}) => {
    const [breakpoint, setBreakpoint] = React.useState('md');
    
    React.useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth;
            if (width < 475) setBreakpoint('xs');
            else if (width < 640) setBreakpoint('sm');
            else if (width < 768) setBreakpoint('md');
            else if (width < 1024) setBreakpoint('lg');
            else if (width < 1280) setBreakpoint('xl');
            else if (width < 1536) setBreakpoint('2xl');
            else setBreakpoint('3xl');
        };
        
        updateBreakpoint();
        window.addEventListener('resize', updateBreakpoint);
        return () => window.removeEventListener('resize', updateBreakpoint);
    }, []);
    
    const content = {
        xs: xs || sm || md || lg || xl || xxl || xxxl || children,
        sm: sm || md || lg || xl || xxl || xxxl || children,
        md: md || lg || xl || xxl || xxxl || children,
        lg: lg || xl || xxl || xxxl || children,
        xl: xl || xxl || xxxl || children,
        '2xl': xxl || xxxl || children,
        '3xl': xxxl || children,
    };
    
    return content[breakpoint] || content.md;
};

/**
 * Mobile-first component that shows content only on mobile
 */
export const MobileOnly = ({ children }) => (
    <Responsive xs={children} sm={null} md={null} lg={null} xl={null} />
);

/**
 * Desktop-only component that shows content only on desktop
 */
export const DesktopOnly = ({ children }) => (
    <Responsive xs={null} sm={null} md={null} lg={children} xl={children} />
);

/**
 * Tablet-only component that shows content only on tablet
 */
export const TabletOnly = ({ children }) => (
    <Responsive xs={null} sm={children} md={children} lg={null} xl={null} />
);

/**
 * Container with responsive padding and max-width
 */
export const Container = ({ 
    children, 
    className = '', 
    size = 'default',
    padding = true 
}) => {
    const sizes = {
        sm: 'max-w-2xl',
        default: 'max-w-7xl',
        lg: 'max-w-6xl',
        xl: 'max-w-7xl',
        full: 'max-w-full',
    };
    
    const paddingClasses = padding 
        ? 'px-4 sm:px-6 lg:px-8' 
        : '';
    
    return (
        <div className={`mx-auto ${sizes[size]} ${paddingClasses} ${className}`}>
            {children}
        </div>
    );
};

/**
 * Grid with responsive columns
 */
export const Grid = ({ 
    children, 
    cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
    gap = 4,
    className = '' 
}) => {
    const gapClasses = {
        2: 'gap-2',
        3: 'gap-3',
        4: 'gap-4',
        6: 'gap-6',
        8: 'gap-8',
    };
    
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-${cols.sm} md:grid-cols-${cols.md} lg:grid-cols-${cols.lg} xl:grid-cols-${cols.xl} ${gapClasses[gap]} ${className}`}>
            {children}
        </div>
    );
};

/**
 * Stack that changes direction based on breakpoint
 */
export const Stack = ({ 
    children, 
    direction = 'column',
    breakpoint: _breakpoint = 'md',
    spacing = 4,
    className = '' 
}) => {
    const spacingClasses = {
        2: 'space-y-2 space-x-2',
        3: 'space-y-3 space-x-3',
        4: 'space-y-4 space-x-4',
        6: 'space-y-6 space-x-6',
        8: 'space-y-8 space-x-8',
    };
    
    const directionClasses = {
        column: 'flex-col space-y-4',
        row: 'flex-row space-x-4',
        'column-mobile': 'flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4',
        'row-mobile': 'flex-row space-x-4 md:flex-col md:space-x-0 md:space-y-4',
    };
    
    return (
        <div className={`flex ${directionClasses[direction]} ${spacingClasses[spacing]} ${className}`}>
            {children}
        </div>
    );
};
