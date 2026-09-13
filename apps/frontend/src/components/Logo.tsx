// @ts-nocheck
import React from 'react';
import logoImg from '../assets/android-chrome-192x192.png';

export const Logo = ({ size = 'md', className = '' }) => {
    const dimensions = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24'
    };

    return (
        <div className={`relative flex items-center justify-center group ${className}`}>
            {/* Main Container */}
            <div className={`${dimensions[size]} rounded-2xl flex items-center justify-center relative overflow-hidden transition-all duration-300`}>
                <img
                    src={logoImg}
                    alt="Tafiti AI"
                    className="w-full h-full object-cover rounded-2xl"
                />
            </div>
        </div>
    );
};

export const LogoWithText = ({ className = '' }) => {
    return (
        <div className={`flex items-center gap-4 ${className}`}>
            <Logo size="md" />
            <span className="text-2xl font-black tracking-tighter dark:text-[#FDFBFA] text-[#3A3D45]">
                Tafiti AI
            </span>
        </div>
    );
};
