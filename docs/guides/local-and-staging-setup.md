# Safe Local and Staging Environment Setup Guide
**Leaf & Kernel / Uvediq Platform (`Mukesh1q2/Leaf-Kernal`)**

---

## 1. Overview & Risk Context

### The Current Risk
In the current setup, local development (`npm run dev`) relies on a `.env` file referencing the **production Supabase project** (`zqumclyhsgzjolbgfcwa`). While read operations on public catalog data are benign, testing database mutations, running local migrations, or invoking serverless endpoints risks corrupting live production state.

To develop safely, engineers must establish either:
1. **A Local Supabase Container Stack** (via Docker Desktop + Supabase CLI), or
2. **A Dedicated Staging Supabase Project** (an isolated free-tier Supabase cloud instance).

---

## 2. Option A: Local Supabase Development Stack (Recommended)

### 2.1 Prerequisites
- **Docker Desktop**: Version 4.25+ installed and running.
- **Node.js**: Version 20.x LTS.
- **Supabase CLI**: Installed via npm or scoop/brew.
  ```powershell
  # Install Supabase CLI locally via npm (or scoop install supabase)
  npm install -D supabase
  # Or install globally:
  npm install -g supabase
  ```

### 2.2 Local Stack Initialization
1. Ensure Docker Desktop is started and responsive (`docker ps`).
2. From the repository root, start the local Supabase container cluster:
   ```powershell
   npx supabase start
   ```
   *This starts local PostgreSQL (port 54322), PostgREST (port 54321), GoTrue Auth, Inbucket (email testing on port 54324), and Supabase Studio (port 54323).*

3. Reset and apply all database migrations and seeds to the local database:
   ```powershell
   npx supabase db reset
   ```
   *This executes all SQL files in `supabase/migrations/` sequentially against local Postgres and loads `supabase/seed.sql`.*

### 2.3 Safe Local Environment Configuration
Create a `.env.local` file in the repository root. **Vite automatically prioritizes `.env.local` over `.env`**:
```bash
# Local Supabase Stack Configuration (Proxied via Vite dev server)
VITE_SUPABASE_URL=http://localhost:8080/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
VITE_SUPABASE_PROJECT_ID=zqumclyhsgzjolbgfcwa

# Analytics (Disabled in development)
VITE_GA_MEASUREMENT_ID=
```

> **Note on Vite Proxy**: `vite.config.ts` includes a proxy rule forwarding `/supabase` requests to `http://127.0.0.1:54321`. This ensures same-origin requests, eliminating CORS preflight overhead and browser Private Network Access (PNA) restrictions.

### 2.4 Local Seed Data & Master Admin Credentials
When `supabase/seed.sql` is applied:
- **Admin Portal**: `http://localhost:8080/admin/login` or `http://localhost:8080/admin/dashboard`
- **Email**: `mukesh1q2@gmail.com`
- **Password**: `TestPass123!`
- **Catalog**: 8 sample Ayurvedic products across 6 categories, 6 health concerns, `LEAF20` promotional coupon, and storefront announcement bar.


---

## 3. Option B: Isolated Cloud Staging Environment

If Docker Desktop is unavailable, create a separate, free-tier Supabase project for staging.

### 3.1 Setup Steps
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project named `leaf-kernel-staging`.
2. Do **NOT** copy live production data containing customer PII or transaction records.
3. Link the repository to the staging project:
   ```powershell
   npx supabase link --project-ref <your-staging-project-ref>
   ```
4. Push migrations to the staging project:
   ```powershell
   npx supabase db push
   ```
5. Deploy Edge Functions to staging:
   ```powershell
   npx supabase functions deploy create-razorpay-order --project-ref <your-staging-project-ref>
   npx supabase functions deploy verify-razorpay-payment --project-ref <your-staging-project-ref>
   npx supabase functions deploy chat --project-ref <your-staging-project-ref>
   ```
6. Set staging secrets (use Razorpay Test Keys `rzp_test_...` and staging Gemini API keys):
   ```powershell
   npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... --project-ref <your-staging-project-ref>
   ```
7. Configure your local `.env.local` to point to the staging project reference.

---

## 4. Verification & Safety Checklist Before Development

- [ ] Verify that Git ignores all `.env` files (`.gitignore` contains `.env`, `.env.*`, and `!.env.example`).
- [ ] Ensure that `npm test` runs with mock or local client fallbacks and never communicates with live production.
- [ ] Confirm `window.location.origin` in Edge Functions allows `http://localhost:8080` for local testing.
- [ ] Never run `npx supabase db push` without verifying the active linked project reference (`npx supabase status` or `npx supabase projects list`).
