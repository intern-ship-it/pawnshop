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
git checkout -- backend/bootstrap/app.php backend/config/cors.php deploy.sh frontend/package-lock.json 2>/dev/null

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Make deploy.sh executable (in case git overwrites permissions)
chmod +x deploy.sh

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
echo "📁 Creating storage directories..."
mkdir -p storage/app/public/customers/ic
mkdir -p storage/app/public/customers/selfie
mkdir -p storage/app/public/documents
mkdir -p storage/app/public/photos
mkdir -p storage/app/public/receipts
mkdir -p storage/app/public/signatures
mkdir -p storage/framework/cache/data
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/logs
mkdir -p bootstrap/cache

# Set permissions BEFORE creating symlink
echo "🔐 Setting permissions..."
chmod -R 775 storage bootstrap/cache

# ========================================
# FIX: STORAGE SYMBOLIC LINK FOR IMAGES
# ========================================
echo "🔗 Setting up storage symbolic link..."

# Remove existing link/folder (whether broken or working)
if [ -L "public/storage" ]; then
    echo "  Removing existing symbolic link..."
    rm -f public/storage
elif [ -d "public/storage" ]; then
    echo "  Removing existing storage folder..."
    rm -rf public/storage
fi

# Create the symbolic link using artisan
echo "  Creating storage link via artisan..."
/opt/cpanel/ea-php82/root/usr/bin/php artisan storage:link

# Verify the link was created
if [ -L "public/storage" ]; then
    echo "  ✅ Storage link created successfully!"
    ls -la public/storage
else
    echo "  ⚠️ Artisan storage:link failed, creating manually..."
    # Manual fallback - use relative path for cPanel compatibility
    cd public
    ln -sf ../storage/app/public storage
    cd ..
    
    if [ -L "public/storage" ]; then
        echo "  ✅ Manual storage link created!"
        ls -la public/storage
    else
        echo "  ❌ ERROR: Could not create storage link!"
        echo "  Please contact hosting provider about symlink permissions"
    fi
fi

# Test if storage is accessible
echo "🧪 Testing storage accessibility..."
if [ -d "public/storage/customers" ]; then
    echo "  ✅ Storage/customers directory accessible"
else
    echo "  ℹ️ Storage/customers not visible yet (will work after first upload)"
fi

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

echo ""
echo "✅ Deployment completed!"
echo "🌐 Visit: https://pajak-kedai.graspsoftwaresolutions.xyz"
echo ""
echo "📋 Storage link status:"
ls -la public/ | grep storage