#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to project
cd ~/public_html/pajak-kedai.graspsoftwaresolutions.xyz

# Backup important files
echo "💾 Backing up server-specific files..."
cp backend/.env backend/.env.backup
cp backend/public/.htaccess backend/public/.htaccess.backup

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin master

# Restore server-specific files
echo "🔄 Restoring server-specific files..."
cp backend/.env.backup backend/.env
cp backend/public/.htaccess.backup backend/public/.htaccess

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

# Cleanup backups
rm -f backend/.env.backup
rm -f backend/public/.htaccess.backup

echo "✅ Deployment completed!"
echo "🌐 Visit: https://pajak-kedai.graspsoftwaresolutions.xyz"