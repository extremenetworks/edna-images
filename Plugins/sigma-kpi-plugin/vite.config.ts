import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production build is hosted under /edna-images/Plugins/sigma-kpi-plugin/ (matches the original dist).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/edna-images/Plugins/sigma-kpi-plugin/' : '/',
  server: {
    port: 3002,
    strictPort: true,
    // Listen on IPv4 + IPv6 so "localhost" resolves either way from the Sigma iframe.
    host: true,
  },
}));
