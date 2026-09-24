#!/usr/bin/env bash
set -e

# ==============================================================================
# Sena Production Droplet Automated Setup Script
# Ubuntu 22.04 / 24.04 LTS
# ==============================================================================

echo "=================================================="
echo " Starting Sena Server Setup & Provisioning"
echo "=================================================="

# 1. Update and upgrade system packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git ufw nginx software-properties-common postgresql postgresql-contrib

# 2. Configure Firewall (UFW)
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 3. Install Node.js 20 LTS and pnpm
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "Installing pnpm & PM2..."
npm install -g pnpm pm2

# 4. Configure PostgreSQL
echo "Configuring PostgreSQL Database..."
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sena_admin') THEN
    CREATE ROLE sena_admin WITH LOGIN PASSWORD 'sena_secure_password_2026';
  END IF;
END
\$\$;"

sudo -u postgres psql -c "SELECT 'CREATE DATABASE sena OWNER sena_admin' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sena')\gexec"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sena TO sena_admin;"

# 5. Clone or Pull Sena Codebase
APP_DIR="/var/www/sena"
if [ ! -d "$APP_DIR" ]; then
    echo "Cloning Sena repository into $APP_DIR..."
    git clone https://github.com/winnerbanjo/sena.git "$APP_DIR"
else
    echo "Updating existing Sena repository in $APP_DIR..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
fi

cd "$APP_DIR"

# 6. Configure Environment Variables
cat <<EOF > "$APP_DIR/.env"
NODE_ENV=production
DATABASE_URL=postgresql://sena_admin:sena_secure_password_2026@localhost:5432/sena
PAYSTACK_SECRET_KEY=sk_test_demo_paystack_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BOOKING_URL=http://localhost:3002
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
EOF

# 7. Install Dependencies and Build Platform
echo "Installing dependencies with pnpm..."
pnpm install --frozen-lockfile=false

echo "Building applications..."
pnpm turbo run build

# 8. Start Services with PM2
echo "Configuring PM2 process manager..."
pm2 delete all 2>/dev/null || true

cd "$APP_DIR"
pm2 start pnpm --name "sena-dashboard" -- --filter @sena/dashboard start -- -p 3000
pm2 start pnpm --name "sena-booking" -- --filter @sena/booking start -- -p 3002
pm2 start pnpm --name "sena-admin" -- --filter @sena/admin start -- -p 3001

pm2 save
pm2 startup systemd -u root --hp /root --force || true

# 9. Configure Nginx Reverse Proxy
echo "Configuring Nginx..."
cat <<'EOF' > /etc/nginx/sites-available/sena
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Sena Dashboard (Default on Port 80)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Sena Direct Booking Engine
    location /book/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Sena Platform Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/sena /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "=================================================="
echo " Sena Server Deployment Complete!"
echo " - Dashboard: http://YOUR_SERVER_IP/"
echo " - Booking:   http://YOUR_SERVER_IP/book/"
echo " - Admin:     http://YOUR_SERVER_IP/admin/"
echo "=================================================="
