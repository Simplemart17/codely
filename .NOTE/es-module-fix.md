# ES Module Configuration Fix

## Issue
The application was failing to start with the error:
```
ReferenceError: require is not defined in ES module scope, you can use import instead
```

## Root Cause
The project is configured as an ES module with `"type": "module"` in package.json, but the `next.config.js` file was using CommonJS syntax (`require` and `module.exports`).

## Solution
Converted `next.config.js` from CommonJS to ES module syntax:

### Changes Made:
1. **Import statement**: Changed from `require('@next/bundle-analyzer')` to `import withBundleAnalyzer from '@next/bundle-analyzer'`
2. **Export statement**: Changed from `module.exports = withBundleAnalyzer(nextConfig)` to `export default bundleAnalyzer(nextConfig)`
3. **Bundle analyzer setup**: Created a separate `bundleAnalyzer` constant to maintain the same functionality

### Before:
```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
// ... config ...
module.exports = withBundleAnalyzer(nextConfig);
```

### After:
```javascript
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});
// ... config ...
export default bundleAnalyzer(nextConfig);
```

## Impact
- Fixes the startup error and allows the application to run properly
- Maintains all existing Next.js configuration including Monaco Editor optimizations, bundle splitting, and headers
- Preserves bundle analyzer functionality for performance analysis

## Additional Fix
Also removed the deprecated `swcMinify: true` option from the Next.js config, as SWC minification is now enabled by default in Next.js 13+.

## Result
✅ **Application is now running successfully!**
- Server started on http://localhost:3000
- Next.js compilation completed successfully
- Socket.io server is running for real-time collaboration features

## Next Steps
The application should now start successfully with `npm run dev` or `docker-compose up`.
