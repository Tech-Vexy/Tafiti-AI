'use client';

import React, { useEffect, useState } from 'react';

/**
 * Smooth animated transition wrapper for page content.
 * Cross-fades and slides up when the route changes.
 */
export const PageTransition = ({ children, routeKey }: { children: React.ReactNode; routeKey?: string | null }) => {
    const [displayChildren, setDisplayChildren] = useState(children);
    const [transitionStage, setTransitionStage] = useState('entered');

    useEffect(() => {
        if (routeKey) {
            // Start exit animation
            setTransitionStage('exiting');
            const timer = setTimeout(() => {
                setDisplayChildren(children);
                setTransitionStage('entering');
                // Start enter animation
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setTransitionStage('entered');
                    });
                });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [routeKey, children]);

    // Keep children in sync when not transitioning
    useEffect(() => {
        if (transitionStage === 'entered') {
            setDisplayChildren(children);
        }
    }, [children, transitionStage]);

    const className = {
        exiting: 'opacity-0 translate-y-2 scale-[0.99]',
        entering: 'opacity-0 translate-y-2 scale-[0.99]',
        entered: 'opacity-100 translate-y-0 scale-100',
    }[transitionStage] || 'opacity-100';

    return (
        <div className={`transition-all duration-200 ease-out ${className}`}>
            {displayChildren}
        </div>
    );
};

export default PageTransition;
