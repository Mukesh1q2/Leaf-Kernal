# Leaf & Kernel | UVEDIQ

> Premium D2C e-commerce platform for plant-powered Ayurvedic superfoods, adaptogens, and wellness nutrition.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2017-3ecf8e.svg)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-176%20Passed-brightgreen.svg)](https://vitest.dev/)

---

## Brand & Entity Information

- **Brand**: UVEDIQ
- **Legal Entity**: LEAF AND KERNEL SUPERFOODS COMPANY (Partnership)
- **Registered Office**: Shop No. 4, Ground Floor, F-8/25, Sector 15, Rohini, New Delhi – 110089, India *(Landmark: Near Happy Associates)*
- **GSTIN**: `07AANFL1400G1ZO`
- **FSSAI License**: `13326998000385`
- **Customer Care**: [customercare@leafandkernel.com](mailto:customercare@leafandkernel.com) | +91 8796745590
- **Storefront URL**: [https://www.leafandkernel.com](https://www.leafandkernel.com)

---

## Architecture Overview

```
                                      +---------------------------------------------+
                                      |             Frontend (Vite / React)         |
                                      |  Storefront · Cart · Admin CMS · Account    |
                                      +----------------------+----------------------+
                                                             |
                           +---------------------------------+---------------------------------+
                           |                                                                   |
                           v                                                                   v
            +------------------------------+                                    +------------------------------+
            |      Supabase Database       |                                    |    Supabase Edge Functions   |
            | - PostgreSQL 17              |                                    | - verify-razorpay-payment    |
            | - Row Level Security (RLS)   |                                    | - create-razorpay-order      |
            | - RBAC (Least Privilege)     |                                    | - chat (Gemini AI Assistant) |
            | - Atomic Stock Ledger        |                                    | - scheduled-publish          |
            | - Guest Order Tracking RPC   |                                    +--------------+---------------+
            +------------------------------+                                                   |
                           ^                                                                   v
                           |                                                    +------------------------------+
                           +----------------------------------------------------+   Third-Party Integrations   |
                                                                                | - Razorpay (Payments)        |
                                                                                | - Resend / SendGrid (Email)  |
                                                                                | - Google Gemini (AI Chat)    |
                                                                                +------------------------------+
```

### Key Subsystems

1. **Storefront & Design System**:
   - Built with Vanilla CSS design tokens & Tailwind utilities, Radix UI primitives, Lucide icons, and Framer Motion micro-interactions.
   - Active Catalog: Four core Ayurvedic superfoods:
     - *UVEDIQ Ashwagandha Powder Capsules (500mg, 100% vegetarian)*
     - *UVEDIQ Jumbo Phool Makhana (6+ Sutta Extra Large Handpicked)*
     - *UVEDIQ Moringa Powder (200g, 100% pure leaf)*
     - *UVEDIQ Wheatgrass Powder (200g, 100% pure green)*
   - Regulatory Compliance: Strict adherence to FSSAI Jaivik Bharat rules (unverified organic claims replaced with truthful botanical declarations).

2. **CMS & Role-Based Access Control (RBAC)**:
   - Built on strict PostgreSQL Row Level Security (RLS) with dedicated roles: `master_admin`, `admin`, `inventory_manager`, `customer_support`, and `content_manager`.
   - Audit logs, financial record deletion prevention, stock movement ledger, coupon scheduler, and announcement bar management.

3. **Payments & Order Integrity**:
   - Razorpay standard checkout supporting UPI (GPay, PhonePe, Paytm), Net Banking, and Cards.
   - Server-side signature verification using Web Crypto API HMAC-SHA256.
   - Atomic inventory synchronization, coupon usage incrementation, and loyalty point protection.
   - Automated Order Confirmation email dispatch (Resend / SendGrid).

4. **Customer Order Tracking & Privacy**:
   - Signed-in order tracking with delivery milestone timeline.
   - Secure Guest Order Tracking RPC (`track_order_public`) enabling unauthenticated order status lookup via Order ID + Billing Email while completely shielding the system against enumeration attacks.

5. **AI Shopping Assistant (Leafy 🌿)**:
   - Google Gemini 1.5 Flash via Edge Function with tool-calling capabilities for live catalog lookup and order status tracking.
   - Persistent database rate limiting (`rate_limit_buckets` table and `check_rate_limit` RPC) to enforce rate limits across serverless cold starts and multi-region worker instances.

---

## Directory Structure

```
leaf-kernel-launch-main/
├── docs/                       # Architecture decisions, migration plans, and deployment guides
│   └── guides/
│       ├── local-and-staging-setup.md
│       └── production-supabase-catalog-sync.sql
├── public/                     # Static assets, branding, and product imagery
├── src/
│   ├── components/             # Reusable UI components (Header, Footer, Newsletter, etc.)
│   ├── contexts/               # React Contexts (AuthContext, CartContext)
│   ├── integrations/           # Supabase client and TypeScript database definitions
│   ├── lib/                    # Business logic (coupons, analytics, audit log, reports)
│   ├── pages/                  # Page routes (Shop, ProductDetail, Cart, TrackOrder, etc.)
│   │   └── admin/              # Admin CMS dashboards and management views
│   └── test/                   # Vitest unit and integration test suites (17 test files)
├── supabase/
│   ├── functions/              # Deno Edge Functions (chat, payments, email dispatch)
│   ├── migrations/             # Sequential SQL schema migrations (PostgreSQL 17)
│   └── seed.sql                # Local development seed data with production guard
└── index.html                  # HTML5 entry point with OpenGraph, Twitter, and SEO tags
```

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker Desktop**: Running locally (required for local Supabase PostgreSQL container)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Mukesh1q2/Leaf-Kernal.git
cd Leaf-Kernal

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root:
```env
# Local Supabase Stack
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Payment Gateway (Razorpay Test Mode)
VITE_RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
```

For Supabase Edge Functions, configure the following secrets in your local or hosted Supabase environment:
```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
GEMINI_API_KEY=...
RESEND_API_KEY=...       # Or SENDGRID_API_KEY for email dispatch
```

### 4. Running the Local Database
```bash
# Start the local Supabase container stack
npx supabase start

# Apply migrations
npx supabase db reset
```

### 5. Running the Application
```bash
# Start the Vite development server
npm run dev
```
Visit `http://localhost:8080` in your browser.

---

## Testing & Quality Assurance

The codebase includes comprehensive unit and integration tests covering role revocation audits, stock movements ledger, delivery consistency, scheduled coupons, announcement bars, and commerce events:

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Build production bundle and check TypeScript types
npm run build
```

---

## Deployment & CI/CD

### 1. GitHub Actions Pipeline
Every push to `main` triggers `.github/workflows/deploy.yml`:
1. Checks out repository.
2. Sets up Node.js environment.
3. Installs dependencies (`npm ci`).
4. Runs full Vitest test suite (`npm test`).
5. Builds the production bundle (`npm run build`).
6. Deploys production artifacts to the VPS host via SSH/rsync.

### 2. Supabase Production Catalog & Settings Sync
To synchronize active catalog products, official GST details, registered Rohini address, and database RPCs to your production Supabase database:
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/zqumclyhsgzjolbgfcwa/sql).
2. Execute the migration script: `supabase/migrations/20261031110000_phase_3_and_4_features.sql`.
3. Execute the sync script: `docs/guides/production-supabase-catalog-sync.sql`.

---

## License & Intellectual Property

Copyright © 2026 **LEAF AND KERNEL SUPERFOODS COMPANY**. All rights reserved.
All formulations, trademarks, brand assets, and content associated with UVEDIQ are the property of Leaf and Kernel Superfoods Company.
