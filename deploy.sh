#!/bin/bash
set -e

echo "Building AI Model Selector..."
npm run build

echo ""
echo "Build completed successfully!"
echo ""
echo "To deploy to Cloudflare Pages, you have two options:"
echo ""
echo "Option 1: Deploy via Wrangler CLI (recommended)"
echo "  npm install -g wrangler"
echo "  wrangler login"
echo "  wrangler pages deploy .svelte-kit/cloudflare"
echo ""
echo "Option 2: Deploy via Cloudflare Dashboard"
echo "  1. Go to https://dash.cloudflare.com/"
echo "  2. Navigate to Workers & Pages"
echo "  3. Click 'Create application' > 'Pages'"
echo "  4. Choose 'Upload Assets' or 'Connect to Git'"
echo "  5. Use these settings:"
echo "     - Build command: npm run build"
echo "     - Build output directory: .svelte-kit/cloudflare"
echo "     - Node.js version: 20"
echo ""
echo "For more information, see README.md"
