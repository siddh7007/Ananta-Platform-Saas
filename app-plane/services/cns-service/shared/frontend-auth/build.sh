#!/bin/bash
set -e

echo "🔧 Building @components-platform/frontend-auth package..."

# Navigate to package directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Build TypeScript
echo "🏗️  Compiling TypeScript..."
npm run build

# Create tarball
echo "📦 Creating tarball..."
npm pack

# Get the generated tarball name
TARBALL=$(ls components-platform-frontend-auth-*.tgz 2>/dev/null | sort -V | tail -n1)

if [ -z "$TARBALL" ]; then
  echo "❌ Error: Tarball not created"
  exit 1
fi

echo "✅ Package built successfully: $TARBALL"
echo ""
echo "To use in dashboards, ensure they reference:"
echo '  "@components-platform/frontend-auth": "file:../../shared/frontend-auth/'$TARBALL'"'
echo ""
echo "Run 'npm install' in each dashboard to update the package."
