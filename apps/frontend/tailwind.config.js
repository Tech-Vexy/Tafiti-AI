/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{ts,tsx,mdx}",
    ],
    safelist: [
        'bg-sky-500/10', 'bg-sky-500/20', 'border-sky-500/20', 'text-sky-400',
        'bg-emerald-500/10', 'bg-emerald-500/20', 'border-emerald-500/20', 'text-emerald-400',
        'bg-amber-500/10', 'bg-amber-500/20', 'border-amber-500/20', 'text-amber-400',
        'bg-rose-500/10', 'bg-rose-500/20', 'border-rose-500/20', 'text-rose-400',
    ],
    theme: {
        container: {
            center: true,
            padding: {
                DEFAULT: '1rem',
                sm: '1.5rem',
                lg: '2rem',
            },
        },
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
                mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
                math: ['KaTeX_Math', 'KaTeX_Main', 'Cambria Math', 'STIX Two Math', 'Latin Modern Math', 'Computer Modern', 'Times New Roman', 'serif'],
                latex: ['KaTeX_Main', 'KaTeX_Math', 'Cambria Math', 'STIX Two Math', 'Latin Modern Math', 'Computer Modern', 'Times New Roman', 'serif'],
            },
            screens: {
                'xs': '475px',
                '2xl': '1536px',
                '3xl': '1920px',
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },
            colors: {
                // User-specified theme palette:
                // Dark mode: #1E1D1C, #383B43, #171616, #171715
                // Light mode: #FDFBFA, #8A8884, #FDFAF9, #3A3D45
                theme: {
                    dark: {
                        bg: '#171616',
                        surface: '#1E1D1C',
                        card: '#171715',
                        border: '#383B43',
                    },
                    light: {
                        bg: '#FDFBFA',
                        surface: '#FDFAF9',
                        muted: '#8A8884',
                        text: '#3A3D45',
                    },
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    50: '#eff6ff',
                    100: '#dbeafe',
                    500: '#2c5f9e',
                    600: '#234e82',
                    700: '#1e436f',
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                mint: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#e6f4f1',
                    500: '#14b8a6',
                    700: '#0f766e',
                },
                peach: {
                    100: '#ffedd5',
                    200: '#fff1e0',
                    500: '#fb923c',
                    700: '#c2410c',
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
