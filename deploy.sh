#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to project
cd ~/public_html/pajak-kedai.graspsoftwaresolutions.xyz

# Backup important files (to /tmp to avoid conflicts)
echo "💾 Backing up server-specific files..."
cp backend/.env /tmp/.env.backup
cp backend/public/.htaccess /tmp/.htaccess.backup

# Remove build assets (will be regenerated after build)
echo "🗑️ Removing old build assets..."
rm -rf backend/public/assets/

# Reset any modified tracked files
echo "🔄 Resetting tracked files..."
git checkout -- backend/bootstrap/app.php backend/config/cors.php 2>/dev/null

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Restore server-specific files
echo "🔄 Restoring server-specific files..."
cp /tmp/.env.backup backend/.env
cp /tmp/.htaccess.backup backend/public/.htaccess

# Build Frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build

# Install Laravel dependencies
echo "🎼 Installing Laravel dependencies..."
cd ../backend
composer install --no-dev --optimize-autoloader

# Create storage directories if missing
mkdir -p storage/app/public
mkdir -p storage/framework/cache/data
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/logs
mkdir -p bootstrap/cache

# Set permissions
chmod -R 775 storage bootstrap/cache

# Clear and cache Laravel (using PHP 8.2)
echo "🧹 Clearing cache..."
/opt/cpanel/ea-php82/root/usr/bin/php artisan config:clear
/opt/cpanel/ea-php82/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php82/root/usr/bin/php artisan view:clear
/opt/cpanel/ea-php82/root/usr/bin/php artisan config:cache
/opt/cpanel/ea-php82/root/usr/bin/php artisan route:cache
/opt/cpanel/ea-php82/root/usr/bin/php artisan view:cache

# Cleanup temp backups
rm -f /tmp/.env.backup
rm -f /tmp/.htaccess.backup

echo "✅ Deployment completed!"
echo "🌐 Visit: https://pajak-kedai.graspsoftwaresolutions.xyz"