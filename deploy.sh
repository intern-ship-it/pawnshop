#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to project
cd ~/public_html/pajak-kedai.graspsoftwaresolutions.xyz

# Pull latest code
git pull origin master

# Build Frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build

# Copy React build to Laravel public (if not using vite outDir)
# cp -r dist/* ../backend/public/

# Install Laravel dependencies
echo "🎼 Installing Laravel dependencies..."
cd ../backend
composer install --no-dev --optimize-autoloader

# Set permissions
chmod -R 775 storage bootstrap/cache

# Clear and cache Laravel
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "✅ Deployment completed!"