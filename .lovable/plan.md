# Leaf & Kernel — Production Readiness Audit

Read-only findings from inspecting the live codebase, DB, storage, RLS, and edge functions. Each item lists severity, root cause, impact, and the exact fix. Nothing has been changed yet — you approve which items I implement.

---

## Phase 1 — Product Image Upload (reported broken)

**Finding: Upload does silently hang / spinner stuck.**

- Severity: **High** (admin workflow blocker; cosmetic — no data loss)
- Files: `src/components/admin/ImageUpload.tsx`, `src/pages/admin/AdminProducts.tsx`
- Storage bucket `product-images`: public, no size limit, no MIME restriction ✓
- RLS on `storage.objects`: INSERT/UPDATE/DELETE all gated by `has_role(auth.uid(),'admin')` ✓ (correct)

Root causes (multiple, compounding):
1. `upload()` in `ImageUpload.tsx` only logs errors to `console.error` and **never resets `uploading` state on non-thrown paths**, but critically **never surfaces the error to the user** → looks like "spinner forever" when the upload actually failed (e.g. non-admin session, expired JWT, network).
2. No client-side validation for file type or size — a 20 MB HEIC will hang the UI while it uploads.
3. Same-file reselection is ignored because `<input>` value is never reset — after one failed try, picking the same file does nothing.
4. `gallery_urls` column exists on `products` but there is **no UI to manage a gallery** — only a single `image_url`. So Phase 4 "gallery/zoom" has no data source in admin.

Fix:
- Rewrite `ImageUpload` with: file type whitelist (jpeg/png/webp/avif), 5 MB size cap, toast on error, reset `<input>.value`, always `finally { setUploading(false) }`, drag-and-drop dropzone.
- Add multi-image gallery uploader wired to `products.gallery_urls`.
- Add "Delete image" button that also removes the file from storage (currently orphaned in bucket forever).

---

## Phase 2 — Wishlist

- Severity: **Medium**
- Files: `src/contexts/WishlistContext.tsx`, no dedicated wishlist page
- Works: add/remove for logged-in users, toast, heart state, DB RLS scoped to `auth.uid()`
- Missing:
  1. **Guest wishlist** — logged-out click just shows "Please login". No localStorage fallback → high drop-off.
  2. **No `/wishlist` page** — items are in DB but no dedicated view (only visible on Account tab).
  3. **No "Move to Cart"** action.
  4. **No wishlist count badge** in header.
  5. Duplicate prevention relies on unique constraint — need to verify: `wishlist_items` has no unique(user_id, product_id) enforced.

Fix: add localStorage guest wishlist that merges on login, `/wishlist` route, header count badge, move-to-cart, DB unique constraint migration.

---

## Phase 3 — Verified Product Reviews

- Severity: **High** (feature exists but nothing lets buyers submit)
- Files: `src/pages/admin/AdminReviews.tsx` (moderation only), no customer submit UI
- Table `reviews` columns: id, product_id, user_id, rating, title, content, is_approved, created_at

Findings:
1. RLS was hardened previously to require a delivered order — good.
2. But **there is no UI on ProductDetail to write a review**. Users cannot review at all.
3. `product.rating` / `review_count` are static columns — no trigger recomputes them from approved reviews. They drift.
4. No "edit review" / "delete own review" for customers.
5. No sorting/filtering on the PDP reviews list (there is no reviews list on PDP at all — only the aggregate stars).

Fix: build `ReviewsSection` on PDP (list + submit form gated by verified purchase), trigger to recompute `products.rating` and `review_count` on review insert/update/delete/approve, allow self-edit/delete of own review, one-review-per-order constraint already enforced by RLS.

---

## Phase 4 — Product Detail Page (missing fields)

Present today: image, price, MRP, discount %, rating, review count, quantity picker, add to cart, wishlist, tabs (description/ingredients/how-to-use/benefits), subscribe & save, FBT.

Missing:
- Image gallery + zoom (schema has `gallery_urls` — unused)
- Stock indicator ("Only 3 left"), SKU, brand
- Weight/quantity variants (100g, 250g)
- Form (Powder/Capsule/Tablet)
- Storage instructions, shelf life, country of origin, manufacturer, FSSAI license
- Nutrition facts table
- Return / refund / shipping policy blocks
- Estimated delivery (has pincode checker on cart, none on PDP)
- Reviews list (see Phase 3)
- Product FAQ
- SEO metadata (`<title>`, meta description, `og:*`), JSON-LD Product schema
- Breadcrumbs — present ✓
- Social share buttons
- Recently viewed rail
- Compare (no compare feature at all)

Fix: schema migration to add `sku, brand, weight, form, storage_instructions, shelf_life, country_of_origin, manufacturer, fssai_license, nutrition_facts jsonb, product_faqs jsonb, gallery_urls[]` (some already exist). Admin UI to edit them. PDP components + JSON-LD + react-helmet meta.

---

## Phase 5 — Product Highlights strip

Not implemented at all. Needs new columns: `is_organic, is_vegan, is_gluten_free, is_preservative_free, suitable_for` + a Highlights component rendering badges. Depends on Phase 4 migration.

---

## Phase 6 — User Account

Pages exist: `Auth`, `Account`, `ForgotPassword`, `ResetPassword`.

Findings:
- No dedicated **Address Book** page — addresses table exists (12 cols) but no UI to manage saved addresses (checkout re-collects every time).
- No **Change Password** while logged in (only forgot-password flow).
- No **Delete Account** (GDPR/DPDP concern for India launch).
- No **Email verification enforcement** — Supabase may allow unconfirmed emails to shop.
- Wishlist/Reviews/Notifications live inside `Account.tsx` tabs — OK, but no deep-link tab routing (refresh loses state).
- Session persistence: relies on Supabase default (localStorage) — OK. `getUser()` vs `getSession()` audit needed in `AuthContext`.

---

## Phase 7 — Navigation Menu vs Sidebar

- Severity: **Medium** — reported broken by you, but code + DB actually match.
- `Header.tsx` uses hardcoded links `/shop?category=powders` etc.
- `categories` table slugs are exactly: `powders, capsules, oils-ghee, seeds-grains, teas-infusions, bundles` ✓
- `Shop.tsx` reads `?category=` slug and filters ✓

Real problems:
1. **Hardcoded list** in header will drift the moment an admin adds/renames a category. Sidebar reads DB → source-of-truth mismatch. Likely why you see mismatch: newly added categories don't appear in the top nav.
2. Mobile menu (need to verify) may not include all categories.
3. "Shop by Goal" (health_concerns) may not be wired into nav — health_concerns cards on homepage link to `/shop?concern=`, but header has no Goals dropdown.

Fix: replace hardcoded arrays in `Header.tsx` with a `useCategories()` + `useHealthConcerns()` hook. Single source of truth.

---

## Phase 8 — Lovable Environment Dependencies

| Feature | Depends on | Portable? |
|---|---|---|
| Auth | Supabase Auth (Lovable Cloud) | Yes → self-host Supabase or GoTrue |
| DB | Supabase Postgres | Yes → any Postgres + PostgREST |
| Storage | Supabase Storage | Yes → self-host or S3 + CDN |
| Edge functions (`chat`, `mcp`, `create-razorpay-order`, `verify-razorpay-payment`, `scheduled-publish`, `generate-product-image`) | Deno Deploy via Supabase | Portable → rewrite as Node/Express or keep self-hosted Supabase |
| `LOVABLE_API_KEY` (AI Gateway used by `chat` + `generate-product-image`) | Lovable-only | Replace with OpenAI/Anthropic/Gemini direct keys |
| MCP server (`.lovable/mcp`) | Lovable MCP runtime | Rebuild with a standard MCP server if needed off-Lovable |
| Preview URLs, publish, custom domain | Lovable hosting | Replace with your VPS + Nginx |
| Cron / scheduled-publish | Supabase Cron | Replace with system cron / pg_cron |
| Realtime (notifications, chat) | Supabase Realtime | Self-hostable |
| VITE_SUPABASE_* env | Supabase URL/key | Point to your Supabase |
| Secrets storage | Lovable Cloud secrets | Move to `.env` on VPS or Doppler/Vault |

---

## Phase 9 — VPS Migration Checklist (summary)

Recommended stack: **Ubuntu 22.04 + Docker Compose + Nginx + Certbot + self-hosted Supabase (Postgres/GoTrue/Storage/Realtime) + PM2 for any Node workers + UptimeRobot + weekly `pg_dump` to S3-compatible bucket**.

Deliverables to prepare (if you want me to build these): `docker-compose.yml`, `Dockerfile` for the Vite build, Nginx config with SPA fallback + gzip + cache headers, Certbot script, `.env.example`, GitHub Actions CI (build → SSH deploy), migration script from Lovable Supabase → self-hosted Supabase (`pg_dump` + `storage` bucket rsync + auth JWT re-signing).

---

## Phase 10 — Customer vs Admin separation

- `has_role(uuid, app_role)` SECURITY DEFINER function ✓
- `user_roles` table with master-admin flag ✓
- Admin routes: need to verify `AdminLayout` blocks non-admins client-side — server-side (RLS) already blocks.
- APIs: all admin mutations go through RLS-checked tables ✓ except `admin_adjust_loyalty` (service_role only) ✓
- Missing: rate-limit on `/auth` (login brute-force), no audit trail for admin_activity_log usage across all admin actions (partial coverage).

---

## Phase 11 — Database integrity

Quick checks needed (I can run each):
- `wishlist_items` unique(user_id, product_id) — likely missing
- `cart_items` unique(user_id, product_id) — likely missing (dupes on double add)
- `reviews` unique(user_id, product_id, order_id) — missing (spam protection)
- Indexes on `products.category_id`, `products.slug`, `order_items.order_id`, `user_activity.user_id/product_id/created_at`, `notifications.user_id`
- Cascade deletes on `auth.users` → profiles/wishlist/cart already present via handle_new_user pattern; verify.

---

## Phase 12 — Security (delta since last scan)

- HIBP password check ON ✓
- RLS hardened last round ✓
- Remaining: **`subscription_discount_trust`** (client sets own discount_pct on subscriptions) — Medium.
- No rate limiting on edge functions (`chat`, `create-razorpay-order`) — susceptible to abuse costing money on AI Gateway and Razorpay quota.
- `generate-product-image` publicly callable — verifies admin in code ✓
- CORS `*` on all edge functions — acceptable for public storefront, but tighten `chat` to your origin.
- No CSP headers set in `index.html` / hosting.
- Image upload has no MIME/size validation client-side (Phase 1) and none server-side (bucket has no restriction).

---

## Phase 13 — Production Readiness Score

| Area | Score |
|---|---|
| Frontend | 7/10 |
| Backend (edge functions) | 7/10 |
| Database schema | 7/10 |
| CMS / Admin | 6/10 |
| Auth | 8/10 |
| Authorization / RBAC | 8/10 |
| Payments (Razorpay) | 8/10 |
| Wishlist | 5/10 |
| Reviews | 3/10 |
| Product Management | 5/10 |
| Performance | 6/10 (no lazy images, no CDN cache headers) |
| SEO | 4/10 (no per-page meta, no JSON-LD) |
| Accessibility | 6/10 (missing form labels, focus states OK) |
| Security | 8/10 |
| Maintainability | 7/10 |
| Scalability | 7/10 |

**Overall: 6.4 / 10 — not yet ready for a public launch.**

---

## Phase 14 — Final Prioritized Backlog

**Critical (blocks launch)**
1. Fix product image upload (Phase 1) — full rewrite of `ImageUpload` + gallery UI
2. Customer review submission on PDP + verified-buyer check + rating recompute trigger (Phase 3)
3. Address book UI + save-at-checkout (Phase 6)
4. Header nav reads categories/goals from DB (Phase 7)
5. Rate-limit `chat` and `create-razorpay-order` edge functions

**High**
6. Product highlights + missing fields (SKU, brand, weight, form, FSSAI, shelf life, storage) with schema migration + admin UI (Phases 4 & 5)
7. Image gallery with zoom on PDP
8. Guest wishlist (localStorage) + `/wishlist` page + header badge (Phase 2)
9. SEO: react-helmet per-page titles/descriptions + Product JSON-LD
10. Change password, delete account, email verification enforcement (Phase 6)
11. Fix `subscription_discount_trust` — server-side discount recompute

**Medium**
12. Recently viewed, compare products
13. Product FAQ block on PDP
14. Estimated delivery on PDP (reuse pincode checker)
15. DB constraints: unique wishlist/cart/review, indexes
16. Admin audit log coverage across all admin mutations
17. CSP + tightened CORS

**Low / Nice-to-have**
18. Nutrition facts editor
19. Deep-link tab routing on Account page
20. Compare page

**Separate track (VPS)**
21. Dockerize, Nginx, Certbot, self-hosted Supabase migration, backups, CI/CD (Phase 9)

---

## What I'd like to do next

Pick one of these to execute immediately (I'll do them in order you specify):

- **A. Critical bundle (items 1–5)** — one turn, will require a DB migration for image gallery cleanup + rate-limit table.
- **B. Just Phase 1 image upload + Phase 3 reviews** — smallest useful ship.
- **C. Everything Critical + High (1–11)** — 2–3 turns, multiple migrations.
- **D. Different order** — tell me which numbers.

Reply with A/B/C/D (and any numbers to reorder) and I'll start building.
