

## Comprehensive Plan: Stripe Checkout, Admin Dashboard, Product Images, and Search

This plan covers four major work streams. Each is broken into concrete implementation steps.

---

### 1. Stripe Checkout Integration

**Goal**: Wire the "Proceed to Checkout" button on Cart to a Stripe-powered payment flow.

**Steps**:

1. **Enable Stripe connector** -- use the Stripe integration tool to collect the secret key and activate the connector.
2. **Create `create-checkout` edge function** (`supabase/functions/create-checkout/index.ts`):
   - Accepts cart items + user auth token.
   - Reads cart from DB (server-side, not trusting client prices).
   - Creates a Stripe Checkout Session with line items, shipping, success/cancel URLs.
   - Creates a pending `orders` row + `order_items` rows, stores `stripe_session_id`.
   - Returns the Stripe Checkout URL.
3. **Create `stripe-webhook` edge function** (`supabase/functions/stripe-webhook/index.ts`):
   - Verifies Stripe signature.
   - On `checkout.session.completed`: updates order status to `confirmed`, clears the user's cart.
   - On `checkout.session.expired`: updates order status to `cancelled`.
4. **Update Cart.tsx**: "Proceed to Checkout" calls the edge function via `supabase.functions.invoke("create-checkout")`, then redirects to Stripe.
5. **Create a `/checkout/success` page** and `/checkout/cancel` page with appropriate messaging and links back to orders/shop.
6. **Add routes** in App.tsx for the new pages.

---

### 2. Admin Dashboard

**Goal**: A protected `/admin` area for managing products, orders, blog posts, and FAQs.

**Steps**:

1. **Database**: Add an RLS policy on `product_health_concerns` for admin INSERT/UPDATE/DELETE (currently missing -- admins can't manage product-concern mappings).
2. **Create admin layout** (`src/components/admin/AdminLayout.tsx`):
   - Sidebar with navigation: Dashboard, Products, Orders, Blog, FAQs.
   - Uses the existing `has_role` function to gate access -- fetches user role client-side on mount, redirects non-admins.
3. **Admin pages**:
   - **`/admin`** (`AdminDashboard.tsx`): Summary cards (total products, pending orders, total revenue, recent orders).
   - **`/admin/products`** (`AdminProducts.tsx`): Table of all products with edit/delete actions. "Add Product" form in a dialog/sheet.
   - **`/admin/orders`** (`AdminOrders.tsx`): Table of all orders with status filter + ability to update status (pending -> confirmed -> shipped -> delivered).
   - **`/admin/blog`** (`AdminBlog.tsx`): Table of blog posts with publish/unpublish toggle, edit in dialog.
   - **`/admin/faqs`** (`AdminFAQs.tsx`): Manage FAQs with add/edit/delete.
4. **Route protection**: Admin routes wrapped in a component that checks `has_role(uid, 'admin')` via an RPC call and redirects to `/` if not admin.
5. **Add routes** in App.tsx under `/admin/*`.
6. **Header update**: If user has admin role, show an "Admin" link in the account dropdown or header.

---

### 3. Product Image Generation

**Goal**: Generate high-quality product images for each seeded product using the AI image generation API.

**Steps**:

1. **Create `generate-product-image` edge function**:
   - Accepts a product ID and prompt.
   - Calls the Lovable AI gateway with `google/gemini-2.5-flash-image` model.
   - Receives base64 image, uploads it to a new `product-images` storage bucket.
   - Updates the product's `image_url` in the database.
2. **Create storage bucket** via migration: `product-images` (public, with appropriate RLS policies allowing public read and admin write).
3. **Admin Products page**: Add a "Generate Image" button per product that triggers the edge function.
4. **Batch generation**: Optionally, a "Generate All Missing" button on the admin dashboard.

---

### 4. Search Functionality

**Goal**: A search bar in the header with live product suggestions.

**Steps**:

1. **Update Header.tsx**: Replace the static search icon button with a search input that opens a command palette (using the existing `cmdk` / Command component).
2. **Search component** (`src/components/SearchDialog.tsx`):
   - Uses `Dialog` + `Command` (already installed via `cmdk`).
   - On input change, queries `supabase.from("products").select("id, name, slug, image_url, price").ilike("name", `%${query}%`).limit(8)`.
   - Shows results with product image thumbnails, names, and prices.
   - Clicking a result navigates to `/product/:slug`.
   - Also searches blog posts: `supabase.from("blog_posts").select("id, title, slug").ilike("title", `%${query}%`).eq("is_published", true).limit(4)`.
3. **Keyboard shortcut**: Cmd+K / Ctrl+K to open search.
4. **Mobile**: Search icon opens the same dialog in full-screen mode.

---

### Implementation Order

```text
Phase 1 (this session):
  1. Enable Stripe
  2. Build search dialog
  3. Build admin layout + dashboard overview

Phase 2 (follow-up):
  4. Stripe edge functions (create-checkout, stripe-webhook)
  5. Checkout success/cancel pages
  6. Admin CRUD pages (products, orders, blog, FAQs)

Phase 3 (follow-up):
  7. Product image generation via edge function
  8. Storage bucket setup
```

### Technical Notes

- All admin queries rely on existing RLS policies using `has_role(auth.uid(), 'admin')`. The `user_roles` table already exists with the correct schema.
- The `cmdk` package is already installed, so the search command palette requires no new dependencies.
- Stripe integration requires the user's Stripe secret key, which will be collected via the Stripe connector tool.
- Edge functions will use `SUPABASE_SERVICE_ROLE_KEY` (already configured) for server-side DB operations and `LOVABLE_API_KEY` for AI image generation.
- A migration is needed to: (a) create the `product-images` storage bucket, (b) add admin management policies to `product_health_concerns`.

