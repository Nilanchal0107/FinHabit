import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Custom Vite plugin: serves /firebase-sw-config.js dynamically in dev mode
 * and emits it as a static build asset in production.
 *
 * The service worker can't access import.meta.env, so we inject the Firebase
 * config through a separate JS file that the SW importScripts() at runtime.
 *
 * self.FIREBASE_SW_CONFIG is set by this file and read by firebase-messaging-sw.js.
 */
function swConfigPlugin(env) {
  const configContent = (config) =>
    `self.FIREBASE_SW_CONFIG = ${JSON.stringify(config)};`;

  function buildConfig(e) {
    return {
      apiKey:            e.VITE_FIREBASE_API_KEY            || '',
      authDomain:        e.VITE_FIREBASE_AUTH_DOMAIN        || '',
      projectId:         e.VITE_FIREBASE_PROJECT_ID         || '',
      storageBucket:     e.VITE_FIREBASE_STORAGE_BUCKET     || '',
      messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId:             e.VITE_FIREBASE_APP_ID             || '',
    };
  }

  return {
    name: 'sw-config-plugin',

    // Dev mode: intercept /firebase-sw-config.js with a virtual endpoint
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-sw-config.js') return next();
        const content = configContent(buildConfig(env));
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Service-Worker-Allowed', '/');
        res.end(content);
      });
    },

    // Build mode: emit firebase-sw-config.js as a static asset
    generateBundle() {
      this.emitFile({
        type:     'asset',
        fileName: 'firebase-sw-config.js',
        source:   configContent(buildConfig(env)),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      swConfigPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: false, // Using public/manifest.json
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Exclude FCM files — they are handled separately by the Firebase SDK
          globIgnores: ['firebase-messaging-sw.js', 'firebase-sw-config.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        // Enable service worker in dev for testing Web Share Target & PWA install
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages':      path.resolve(__dirname, 'src/pages'),
        '@store':      path.resolve(__dirname, 'src/store'),
        '@hooks':      path.resolve(__dirname, 'src/hooks'),
        '@services':   path.resolve(__dirname, 'src/services'),
        '@utils':      path.resolve(__dirname, 'src/utils'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
