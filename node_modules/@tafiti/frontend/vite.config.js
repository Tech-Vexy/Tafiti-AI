import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],

    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },

    build: {
        // Raise the warning threshold slightly — we deliberately split below
        chunkSizeWarningLimit: 600,

        rollupOptions: {
            output: {
                /**
                 * Manual chunk strategy:
                 *  vendor-react   — React + ReactDOM (stable, long-cached)
                 *  vendor-clerk   — Clerk auth (large, rarely changes)
                 *  vendor-ui      — lucide-react icons
                 *  vendor-misc    — axios + other small deps
                 *  views          — Heavy page views (lazy-loaded anyway, but grouped)
                 */
                manualChunks(id) {
                    // Group heavy view components into their own chunk
                    if (
                        id.includes('GapAnalysisView') ||
                        id.includes('CollaborationView') ||
                        id.includes('BillingView') ||
                        id.includes('CitationGraphView') ||
                        id.includes('SynthesisView') ||
                        id.includes('ResearchChatView') ||
                        id.includes('DiscoverView') ||
                        id.includes('ProfileView')
                    ) {
                        return 'views';
                    }
                },
            },
        },

        // Minification — use esbuild (default, fastest) with aggressive dead-code removal
        minify: 'esbuild',

        // Source maps in production are large — disable for prod bundle size
        sourcemap: false,

        // Target modern browsers — avoids legacy polyfills
        target: 'esnext',
    },
});
