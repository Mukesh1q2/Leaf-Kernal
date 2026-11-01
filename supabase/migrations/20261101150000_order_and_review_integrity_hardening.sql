-- ==============================================================================
-- Migration: Order & Review Integrity Hardening
-- 
-- 1. Closes Direct Order Injection Vulnerability:
--    Drops legacy "Users create own orders" and "Users create own order items"
--    RLS policies that allowed client-side JWTs to insert arbitrary orders.
--    All commercial orders and line items MUST originate exclusively from the
--    server-side Edge Function (create-razorpay-order via service_role) or CMS admins.
--
-- 2. Prevents Inventory Depletion & Fraud:
--    Blocks unauthorized insertion of orders with status 'confirmed' or 'delivered'
--    that would otherwise trigger automatic stock deduction or fake order history.
--
-- 3. Enforces Review Moderation Integrity:
--    Requires is_approved = false when verified purchasers submit product reviews,
--    preventing client-side self-approval of reviews.
-- ==============================================================================

-- 1. Orders Table: Drop direct client insert policy; allow admin-only direct insert
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Admins can insert orders'
  ) THEN
    CREATE POLICY "Admins can insert orders"
      ON public.orders
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.is_master_admin(auth.uid())
      );
  END IF;
END $$;

-- 2. Order Items Table: Drop direct client insert policy; allow admin-only direct insert
DROP POLICY IF EXISTS "Users create own order items" ON public.order_items;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'Admins can insert order items'
  ) THEN
    CREATE POLICY "Admins can insert order items"
      ON public.order_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.is_master_admin(auth.uid())
      );
  END IF;
END $$;

-- 3. Reviews Table: Require is_approved = false on insert
DROP POLICY IF EXISTS "Verified purchasers create one review" ON public.reviews;

CREATE POLICY "Verified purchasers create one review"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_approved = false
  AND EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = auth.uid()
      AND oi.product_id = reviews.product_id
      AND o.status = 'delivered'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.user_id = auth.uid()
      AND r.product_id = reviews.product_id
  )
);

COMMENT ON POLICY "Admins can insert orders" ON public.orders IS
  'Security: Prohibits direct client order injection. Commercial orders are created exclusively via server-side create-razorpay-order function.';
