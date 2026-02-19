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
            {/* Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-emerald-400 rounded-2xl opacity-20 group-hover:opacity-40 transition-opacity blur-lg animate-pulse" />

            {/* Main Container */}
            <div className={`${dimensions[size]} rounded-2xl flex items-center justify-center shadow-2xl relative overflow-hidden group-hover:rotate-6 transition-all duration-500 ease-in-out`}>
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
            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Tafiti AI
            </span>
        </div>
    );
};
