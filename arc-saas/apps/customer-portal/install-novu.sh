#!/bin/bash

# Novu Notification Center Installation Script
# Run from: arc-saas/apps/customer-portal

echo "============================================"
echo "Installing Novu Notification Center"
echo "============================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "Error: package.json not found"
  echo "Please run this script from arc-saas/apps/customer-portal"
  exit 1
fi

# Check for bun or npm
if command -v bun &> /dev/null; then
  echo "Using Bun package manager..."
  bun add @novu/notification-center
elif command -v npm &> /dev/null; then
  echo "Using npm package manager..."
  npm install @novu/notification-center
else
  echo "Error: Neither bun nor npm found"
  exit 1
fi

echo ""
echo "============================================"
echo "Installation Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env (if not already done)"
echo "2. Ensure Novu services are running (docker-compose up -d)"
echo "3. Start the dev server: bun run dev"
echo "4. Look for the bell icon in the header"
echo ""
echo "See NOVU_SETUP.md for detailed instructions"
echo ""
