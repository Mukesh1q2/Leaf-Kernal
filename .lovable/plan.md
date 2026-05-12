# Build Order: Quiz → Reorder → Subscriptions

I'll build all three features sequentially in this turn. Each feature is self-contained and ships fully working before moving to the next.

---

## 1. Concern-Based Product Quiz (`/quiz`)

**Goal:** Interactive 4-step quiz that recommends 3-6 products based on user's health goals, lifestyle, age band, and dietary preference.

**UX flow:**
- Step 1: Primary health concern (multi-select from `health_concerns` table — Gut, Immunity, Sleep, Energy, Skin, Joint)
- Step 2: Lifestyle (Active / Sedentary / Stressed / Balanced)
- Step 3: Age band (18-30 / 31-45 / 46-60 / 60+)
- Step 4: Format preference (Powders / Capsules / Teas / No preference)
- Result page: ranked product list with "Why this?" reasons, Add-to-Cart, "Save my plan" (writes to `user_activity` as `quiz_complete`)

**Tech:**
- New page `src/pages/Quiz.tsx` with framer-motion step transitions
- Scoring algorithm in `src/lib/quiz.ts`: score = (concern match × 3) + (format match × 1) + rating boost
- New header link "Take Quiz" + homepage CTA banner
- Route: `/quiz` added to `App.tsx`

**No DB changes needed** — uses existing `products`, `health_concerns`, `product_health_concerns`, `categories`.

---

## 2. 1-Click Reorder Flow

**Goal:** From `/account` orders list and order detail, a "Reorder" button that re-adds all items from a past order back into the cart.

**UX:**
- "Reorder" button on each delivered order card in Account page
- Skips out-of-stock items, toasts a summary ("5 of 6 items added; 1 unavailable")
- Redirects to `/cart`

**Tech:**
- Helper `reorderFromOrder(orderId)` in `src/lib/reorder.ts`
- Loads `order_items`, validates stock from `products`, bulk-inserts into `cart_items`
- Wire up button in `src/pages/Account.tsx`

**No DB changes needed.**

---

## 3. Subscriptions / Repeat Orders

**Goal:** Customer can subscribe to a product (15/30/60-day cadence) at 10% discount, manage from `/account → Subscriptions`, admin can view all.

**Schema (new migration):**

```sql
create table public.subscriptions (
  id uuid pk,
  user_id uuid not null,
  product_id uuid not null,
  quantity int not null default 1,
  cadence_days int not null check (cadence_days in (15, 30, 60, 90)),
  discount_pct numeric not null default 10,
  status text not null default 'active', -- active|paused|cancelled
  next_charge_at timestamptz not null,
  last_charge_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: user manages own; admin manages all
```

- Site setting `subscription_default_discount_pct = 10`

**UX:**
- PDP: "Subscribe & Save 10%" toggle below "Add to Cart" — opens cadence selector → creates subscription on confirm (login required)
- `src/pages/AccountSubscriptions.tsx` (or section inside Account): list with Pause/Resume/Cancel/Skip-next buttons + next charge date
- `src/pages/admin/AdminSubscriptions.tsx`: admin view, sidebar entry

**Tech:**
- `src/lib/subscriptions.ts` hooks: `useMySubscriptions`, `createSubscription`, `updateSubscriptionStatus`
- For now, subscription = scheduling/intent only (actual recurring billing requires Razorpay subscriptions API which is separate work). I'll add a clear admin column "Action needed" so admin can manually run renewal until billing automation is wired. This is the standard incremental approach.

---

## Files to Create

- `src/pages/Quiz.tsx`
- `src/lib/quiz.ts`
- `src/lib/reorder.ts`
- `src/lib/subscriptions.ts`
- `src/pages/admin/AdminSubscriptions.tsx`
- `supabase/migrations/<ts>_subscriptions.sql`

## Files to Edit

- `src/App.tsx` — add `/quiz`, `/admin/subscriptions` routes
- `src/components/Header.tsx` — add "Quiz" link
- `src/components/HeroSection.tsx` or homepage — add quiz CTA
- `src/pages/Account.tsx` — add Reorder buttons + Subscriptions section
- `src/pages/ProductDetail.tsx` — add Subscribe & Save UI
- `src/components/admin/AdminSidebar.tsx` — add Subscriptions entry

After each feature I'll verify the build is clean before moving to the next.