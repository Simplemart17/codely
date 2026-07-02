import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import withBundleAnalyzer from '@next/bundle-analyzer';

const __dirname = dirname(fileURLToPath(import.meta.url));

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Anchor Turbopack to the project root (prevents parent-dir lockfile confusion)
  turbopack: {
    root: __dirname,
  },

  // Optimize package imports.
  // NOTE: Do NOT add monaco-editor / @monaco-editor/react here. This option
  // tree-shakes a package down to the named exports you reference, which strips
  // Monaco's side-effect-only service registrations (e.g. registerSingleton for
  // IUndoRedoService). That causes a runtime crash on editor creation:
  // "[createInstance] modelService depends on undoRedoService which is NOT registered."
  // Only safe for barrels of independent exports (e.g. lucide-react icons).
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Trusted origins for server actions when running behind a proxy/tunnel.
    // Next already allows same-origin; this appends the public host(s) so the
    // action Origin/Host check still passes if a forwarded host ever differs.
    // Comma-separated via SERVER_ACTIONS_ALLOWED_ORIGINS (baked at build time);
    // a no-op when unset, so local dev is unaffected.
    ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS
      ? {
          serverActions: {
            allowedOrigins: process.env.SERVER_ACTIONS_ALLOWED_ORIGINS.split(',')
              .map((origin) => origin.trim())
              .filter(Boolean),
          },
        }
      : {}),
  },

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Headers for Monaco Editor and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            // Production build artifacts are content-hashed and safe to cache
            // forever. In dev, Turbopack reuses chunk URLs across edits, so
            // `immutable` makes the browser serve stale JS on every reload
            // (changes only appear via HMR or a hard refresh). Disable caching
            // in dev so a normal reload always gets fresh code.
            key: 'Cache-Control',
            value:
              process.env.NODE_ENV === 'production'
                ? 'public, max-age=31536000, immutable'
                : 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },

  // Transpile Monaco Editor packages
  transpilePackages: ['@monaco-editor/react', 'monaco-editor'],

  // Image optimization with remotePatterns (replaces deprecated domains)
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: true,

  // Output configuration for standalone deployment
  output: 'standalone',
};

export default bundleAnalyzer(nextConfig);
