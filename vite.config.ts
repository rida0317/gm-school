import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    base: '/', // Use absolute paths for web hosting
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@services': path.resolve(__dirname, './src/services'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@store': path.resolve(__dirname, './src/store'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },
    },
    // Define environment variables explicitly for production builds
    define: {
      __CSP_NONCE__: JSON.stringify(''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'process.env.VITE_SMS_ENABLED': JSON.stringify(env.VITE_SMS_ENABLED),
    },
  server: {
    port: 3000,
    host: true, // Allow external access (for testing on network)
    open: true, // Auto-open browser for web development
    strictPort: true,
    // 🔒 SECURITY: Add security headers for development
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
    // 🔧 CORS Proxy for API (Development only)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // 🔒 SECURITY: Don't expose source maps in production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 🔒 SECURITY: Remove console.logs in production
        drop_debugger: true, // 🔒 SECURITY: Remove debuggers in production
      },
    },
    // 🔒 SECURITY: Configure Content Security Policy for production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2', 'recharts'],
          utils: ['xlsx', 'jspdf', 'jspdf-autotable', 'zustand'],
        },
      },
    },
    // 🔒 SECURITY: Add integrity hashes for SRI
    // Note: Generate these after build with: openssl dgst -sha384 -binary dist/assets/*.js | openssl base64 -A
  },
  }
})
