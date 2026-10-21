# Leaf & Kernel — Production Deployment Runbook & Handover

This runbook describes the verified procedure for deploying the **Leaf & Kernel** e-commerce application to an Ubuntu VPS behind Cloudflare, with backend services on Supabase and payments processed through Razorpay.

---

## 1. Prerequisites & Target Architecture

- **Operating System:** Ubuntu 24.04 LTS / Ubuntu 26.04 LTS
- **VPS Deployment Account:** `dev` (with `sudo` privileges)
- **Node.js Runtime:** v20.x LTS (recommended) or v18.x LTS
- **Package Manager:** npm v10+ (matching repository `package-lock.json`)
- **Web Server:** Nginx 1.18+ (SSL module enabled)
- **Architecture Type:** Client-Side Single Page Application (SPA, React 18 + Vite 5 + TypeScript)
- **Production Domain:** `https://leafandkernel.com` (supported alias: `https://www.leafandkernel.com`)
- **Web Root:** `/var/www/leaf-kernel/dist` (or symlinked atomic releases `/var/www/leaf-kernel/current`)

```
[ User Browser ]
       │
       ▼ (HTTPS)
[ Cloudflare CDN & WAF (Proxy Active - Orange Cloud) ]
       │
       ▼ (HTTPS Strict SSL)
[ Ubuntu VPS (Nginx) - Port 443 / 80 ]
  ├── Static Files: /var/www/leaf-kernel/dist (or /current)
  ├── SPA Routing Fallback: `try_files $uri $uri/ /index.html`
  ├── Revalidation: `index.html` served with `no-cache`
  └── Hashed Assets: `/assets/` cached 1 year immutable
       │
       ├── Direct Client Calls ──► [ Supabase (Auth, Postgres DB, Storage) ]
       ├── Razorpay Checkout JS ─► [ Razorpay Standard Checkout Modal ]
       └── Edge Functions ───────► [ Supabase Edge Functions (Origin Restricted) ]
                                     ├── /chat (Gemini AI assistant)
                                     ├── /generate-product-image (Gemini AI image gen)
                                     ├── /create-razorpay-order
                                     ├── /verify-razorpay-payment
                                     └── /scheduled-publish (Cron automated)
```

---

## 2. Multi-Site Safety on the VPS

To guarantee this deployment does **not conflict with other existing websites or services on the VPS**:
1. **Explicit Server Names Only:** The Nginx configuration only listens for `leafandkernel.com` and `www.leafandkernel.com`. It does not use `default_server` or catch-all wildcard server blocks.
2. **Dedicated Directory:** All website assets, releases, and logs are isolated within `/var/www/leaf-kernel/`.
3. **No Port Collisions:** Since Leaf & Kernel is built as static assets served by Nginx, no background Node.js daemon or internal port (such as 3000 or 8080) is kept running in production.

---

## 3. Environment Variable & Secret Management

### A. Frontend Build Configuration (`.env`)
The frontend is compiled into static JavaScript and HTML. Only public client variables prefixed with `VITE_` are baked into the build.

Place this in `/home/dev/leaf-kernel-launch/.env` on the build machine:
```ini
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-public-key>
VITE_SUPABASE_PROJECT_ID=<your-project-ref>

# Optional: Google Analytics 4 (leave blank to disable)
VITE_GA_MEASUREMENT_ID=
```

> **Security Guardrail:** Never place backend secrets (e.g. `RAZORPAY_KEY_SECRET`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in frontend `.env` files or prefix them with `VITE_`.

### B. Supabase Edge Functions Secrets
Server-side secrets must be configured directly within Supabase using the Supabase CLI or the **Supabase Dashboard > Project Settings > Edge Functions > Secrets**:

```bash
supabase secrets set \
  RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxxxxxx" \
  RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx" \
  GEMINI_API_KEY="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  CRON_SECRET="<generate-random-32-byte-hex-token>"
```

*(Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions by Supabase).*

---

## 4. VPS Provisioning & Directory Setup

Run under the `dev` user:
```bash
# 1. Update packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx

# 2. Install Node.js 20 LTS (if building directly on VPS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# 4. Create project release directory
sudo mkdir -p /var/www/leaf-kernel/releases
sudo mkdir -p /var/www/leaf-kernel/shared
sudo chown -R dev:dev /var/www/leaf-kernel
```

---

## 5. Nginx Configuration & SSL/TLS Setup

### Step 1: Install Nginx site configuration
Deploy `nginx.conf` into `/etc/nginx/sites-available/leafandkernel.com`:
```bash
sudo cp /path/to/leaf-kernel-launch/nginx.conf /etc/nginx/sites-available/leafandkernel.com
sudo ln -s /etc/nginx/sites-available/leafandkernel.com /etc/nginx/sites-enabled/
```

### Step 2: Test configuration syntax
```bash
sudo nginx -t
```
Verify that output reports `syntax is ok` and `test is successful`.

### Step 3: Obtain SSL Certificate via Let's Encrypt
```bash
sudo certbot --nginx -d leafandkernel.com -d www.leafandkernel.com
```
Certbot will populate the SSL certificate paths in `nginx.conf`. Verify automatic renewal:
```bash
sudo certbot renew --dry-run
```

### Step 4: Reload Nginx
```bash
sudo systemctl reload nginx
```

---

## 6. Cloudflare DNS & Security Settings

1. **DNS Management (Cloudflare Dashboard > DNS > Records):**
   - Record `A` | Name: `@` | Value: `<VPS_PUBLIC_IPV4>` | Proxy: **Proxied (Orange Cloud)**
   - Record `CNAME` | Name: `www` | Value: `leafandkernel.com` | Proxy: **Proxied (Orange Cloud)**
2. **SSL/TLS Mode (SSL/TLS > Overview):**
   - Mode: **Full (strict)**
   - *(Caution: Do NOT select "Flexible" — it causes infinite redirect loops).*
3. **Always Use HTTPS:**
   - Enable under **SSL/TLS > Edge Certificates**.
4. **WAF & Cache Rules:**
   - Under Security > Bots, enable **Bot Fight Mode**.
   - Under Caching > Cache Rules, configure `/assets/*` to cache at edge.

---

## 7. Atomic Deployment & Rollback Procedure

To ensure zero downtime and instant rollbacks, use atomic symlinks.

### Deployment Script (`deploy.sh`):
```bash
#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/leaf-kernel"
RELEASE_TIME=$(date +%Y%m%d%H%M%S)
NEW_RELEASE="${APP_DIR}/releases/${RELEASE_TIME}"

echo "==> Building fresh production assets..."
npm ci
npm run build

echo "==> Validating build output..."
test -f dist/index.html || { echo "Build failed: index.html missing"; exit 1; }
test -d dist/assets || { echo "Build failed: assets missing"; exit 1; }

echo "==> Copying build to release directory ${NEW_RELEASE}..."
mkdir -p "${NEW_RELEASE}"
cp -r dist/* "${NEW_RELEASE}/"

echo "==> Activating release atomically..."
ln -sfn "${NEW_RELEASE}" "${APP_DIR}/current"

# Update web root if using /dist directly, or point nginx root to /var/www/leaf-kernel/current
sudo chown -R www-data:www-data "${NEW_RELEASE}"
sudo systemctl reload nginx

echo "==> Cleaning old releases (keeping last 5)..."
cd "${APP_DIR}/releases"
ls -dt */ | tail -n +6 | xargs -r rm -rf

echo "==> Deployment completed successfully!"
```

### Instant Rollback:
If an issue occurs after deployment, point the symlink to the previous release:
```bash
cd /var/www/leaf-kernel/releases
PREVIOUS_RELEASE=$(ls -dt */ | sed -n '2p' | tr -d '/')
sudo ln -sfn "/var/www/leaf-kernel/releases/${PREVIOUS_RELEASE}" /var/www/leaf-kernel/current
sudo systemctl reload nginx
echo "Rolled back to ${PREVIOUS_RELEASE}"
```

---

## 8. Supabase Production Setup

### A. Authentication URL Configuration
In Supabase Dashboard > **Authentication** > **URL Configuration**:
- **Site URL:** `https://leafandkernel.com`
- **Redirect URLs:**
  - `https://leafandkernel.com/**`
  - `https://leafandkernel.com/auth`
  - `https://leafandkernel.com/reset-password`
  - `http://localhost:8080/**` (staging / local development)

### B. Database Migration Review & Application
The review rating recomputation migration `supabase/migrations/20260808120000_recompute_product_rating.sql` is verified to be:
- Idempotent (`CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS`).
- Safe against search_path attacks (`SET search_path = public`).
- Compatible with existing `reviews` and `products` table schemas.

Apply this migration via Supabase SQL Editor or `supabase db push`.

### C. Deploy Edge Functions
Deploy hardened edge functions with restricted CORS:
```bash
supabase functions deploy chat
supabase functions deploy generate-product-image
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy scheduled-publish
```

### D. Scheduled Publishing Configuration (`pg_cron`)
`scheduled-publish` automatically activates/deactivates time-based banners and publishes scheduled blog posts.

To trigger it every 10 minutes:
1. In Supabase SQL Editor:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```
2. Schedule cron invocation:
   ```sql
   select cron.schedule(
     'invoke-scheduled-publish',
     '*/10 * * * *',
     $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/scheduled-publish',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
         'x-cron-secret', '<YOUR_CRON_SECRET>'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

---

## 9. Razorpay Payment Setup & Legacy Column Clarification

1. **Credentials & Modes:**
   - Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase Edge Functions Secrets.
   - Use test keys (`rzp_test_...`) during staging; swap to live keys (`rzp_live_...`) before public launch.
2. **Order Lifecycle & Idempotency:**
   - `create-razorpay-order` calculates order subtotal, shipping, and loyalty deductions on the server.
   - `verify-razorpay-payment` validates HMAC-SHA256 signature, ensures order ownership matches the authenticated user, updates status to `confirmed`, and deletes cart items.
   - If an order is already confirmed, subsequent duplicate calls return success idempotently.
   - If signature verification fails, status is safely set to `cancelled` and deducted loyalty points are refunded.
3. **Legacy Column `stripe_session_id` Analysis:**
   - The `orders` table column `stripe_session_id` is a legacy name originally created for Stripe.
   - In the current implementation, it backward-compatibly stores the Razorpay order ID during order creation and the Razorpay payment ID upon verification.
   - It functions reliably and does not cause data integrity issues. **Do not rename this column** without a multi-phase migration (adding `razorpay_order_id`/`razorpay_payment_id` columns, dual-writing, and dropping `stripe_session_id` in a future release).

---

## 10. Open Graph / Asset Storage Migration

> **Action Item Before Launch:**
> In `index.html` lines 17 and 23:
> The Open Graph and Twitter image currently point to:
> `https://storage.googleapis.com/gpt-engineer-file-uploads/EyZ3RK8cMZNMuD09FHNbECIVXBf2/social-images/social-1772256128158-hero-superfoods.webp`
> 
> Because this is hosted on a platform-specific upload bucket:
> 1. Download this image and place it in the repository under `public/og-hero.webp` (or upload to Supabase public storage bucket `product-images/social/og-hero.webp`).
> 2. Update `index.html` `og:image` and `twitter:image` to:
>    `https://leafandkernel.com/og-hero.webp`

---

## 11. Post-Deployment Smoke Test Checklist

Execute these verification checks immediately following production deployment:

### General & Infrastructure
- [ ] Apex domain (`https://leafandkernel.com`) loads with valid HTTPS certificate.
- [ ] Subdomain (`https://www.leafandkernel.com`) redirects or resolves correctly with matching SSL.
- [ ] Browser console reports 0 runtime JavaScript errors.
- [ ] Network tab confirms static assets are served from `/assets/` with `cache-control: public, immutable`.
- [ ] Direct refresh on `/shop`, `/account`, and `/cart` loads successfully without returning 404 (verifying Nginx SPA fallback).
- [ ] `https://leafandkernel.com/robots.txt` and `https://leafandkernel.com/sitemap.xml` resolve with correct domain URLs.

### Customer & Storefront Flows
- [ ] **Catalog & Filters:** Navigate to `/shop`, apply category filters (Powders, Capsules) and verify product listings.
- [ ] **Pincode Delivery Check:** On `/product/:slug`, enter a valid delivery pincode and verify estimated delivery time.
- [ ] **Cart & Discounts:** Add products to cart, apply test coupon `LEAF20`, verify discount calculation and subtotal.
- [ ] **Authentication:** Register a test account, sign in, sign out, and request password recovery. Verify Supabase session persistence.
- [ ] **Customer Isolation:** Verify authenticated user profile only displays the logged-in customer's orders and wishlist.
- [ ] **Quiz:** Complete the Ayurvedic Wellness Quiz at `/quiz` and verify product recommendations.
- [ ] **AI Assistant ("Leafy"):** Open chat widget, send a wellness inquiry, and verify Gemini AI response.
- [ ] **Payment Checkout (Razorpay Test Mode):**
  - Click "Pay with Razorpay".
  - Complete checkout with Razorpay test credentials.
  - Verify redirection to `/checkout-success`.
  - Confirm order status is `confirmed` in database and cart is cleared.
