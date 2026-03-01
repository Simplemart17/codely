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

  // Optimize package imports
  experimental: {
    optimizePackageImports: ['@monaco-editor/react', 'monaco-editor', 'lucide-react'],
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
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
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
