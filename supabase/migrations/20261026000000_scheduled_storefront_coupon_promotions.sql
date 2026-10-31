-- ==============================================================================
-- Migration: Scheduled, Selectively Displayed Storefront Coupon Promotions
-- Adds:
--  1. Columns to public.coupons: show_on_storefront, display_title, display_message,
--     display_from, display_to, max_discount
--  2. Schedule validation constraints (display_to > display_from, valid_to > valid_from)
--  3. Columns to public.orders: coupon_code, coupon_id, coupon_discount
--  4. Secure RLS policies restricting public SELECT to scheduled storefront promotions only
--  5. Public view public.storefront_active_coupons
--  6. Server-side validation RPC public.validate_coupon
--  7. Atomic usage increment RPC public.record_coupon_redemption
--  8. Filtered storefront offers RPC public.get_storefront_promotions
-- ==============================================================================

-- 1. Extend public.coupons columns
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS show_on_storefront boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS display_message text,
  ADD COLUMN IF NOT EXISTS display_from timestamptz,
  ADD COLUMN IF NOT EXISTS display_to timestamptz,
  ADD COLUMN IF NOT EXISTS max_discount numeric;

-- 2. Constraints for display and validity schedule
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_display_schedule_check'
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_display_schedule_check
      CHECK (display_to IS NULL OR display_from IS NULL OR display_to > display_from);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_validity_schedule_check'
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_validity_schedule_check
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from);
  END IF;
END $$;

-- 3. Extend public.orders columns for trusted coupon redemption tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders(coupon_code);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON public.orders(coupon_id);

-- 4. RLS policies on public.coupons
-- Revoke the old public policy that exposed ALL active private/influencer coupons
DROP POLICY IF EXISTS "Active coupons are public" ON public.coupons;
DROP POLICY IF EXISTS "Active coupon codes are public" ON public.coupons;
DROP POLICY IF EXISTS "Storefront public coupons are viewable" ON public.coupons;

-- Public can ONLY view coupons that are explicitly marked for storefront display AND currently active in display schedule
CREATE POLICY "Storefront public coupons are viewable"
ON public.coupons
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND show_on_storefront = true
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_to IS NULL OR valid_to > now())
  AND (display_from IS NULL OR display_from <= now())
  AND (display_to IS NULL OR display_to > now())
  AND (max_uses IS NULL OR used_count < max_uses)
);

-- Ensure admins and CMS editors can manage/view all coupons
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Admins can manage coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
);

-- Table privileges: RLS policies enforce access control (admins manage all, anon/customers only see active scheduled storefront promotions)
GRANT ALL ON public.coupons TO authenticated;
GRANT SELECT ON public.coupons TO anon;
GRANT ALL ON public.coupons TO service_role;

-- 5. Secure public view for storefront promotions
CREATE OR REPLACE VIEW public.storefront_active_coupons
WITH (security_barrier = true)
AS
SELECT
  id,
  code,
  discount_type,
  discount_value,
  max_discount,
  min_order_value,
  valid_from,
  valid_to,
  display_title,
  display_message,
  display_from,
  display_to,
  applicable_to,
  applicable_ids
FROM public.coupons
WHERE is_active = true
  AND show_on_storefront = true
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_to IS NULL OR valid_to > now())
  AND (display_from IS NULL OR display_from <= now())
  AND (display_to IS NULL OR display_to > now())
  AND (max_uses IS NULL OR used_count < max_uses);

GRANT SELECT ON public.storefront_active_coupons TO anon, authenticated;

-- 6. RPC: public.get_storefront_promotions
-- Fetches active storefront promotions, optionally filtered by product or category eligibility
CREATE OR REPLACE FUNCTION public.get_storefront_promotions(
  p_product_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  max_discount numeric,
  min_order_value numeric,
  valid_from timestamptz,
  valid_to timestamptz,
  display_title text,
  display_message text,
  display_from timestamptz,
  display_to timestamptz,
  applicable_to text,
  applicable_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.code,
    c.discount_type,
    c.discount_value,
    c.max_discount,
    c.min_order_value,
    c.valid_from,
    c.valid_to,
    c.display_title,
    c.display_message,
    c.display_from,
    c.display_to,
    c.applicable_to,
    c.applicable_ids
  FROM public.storefront_active_coupons c
  WHERE (
    -- If no target filter passed, return all storefront offers
    (p_product_id IS NULL AND p_category_id IS NULL)
    -- All products offer
    OR c.applicable_to = 'all'
    -- Product specific offer
    OR (p_product_id IS NOT NULL AND c.applicable_to = 'products' AND p_product_id = ANY(c.applicable_ids))
    -- Category specific offer
    OR (p_category_id IS NOT NULL AND c.applicable_to = 'categories' AND p_category_id = ANY(c.applicable_ids))
  )
  ORDER BY c.discount_value DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_storefront_promotions(uuid, uuid) TO anon, authenticated;

-- 7. RPC: public.validate_coupon
-- Trusted server-side coupon validation for both public and private coupon codes
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text,
  p_subtotal numeric,
  p_cart_items jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon record;
  v_item jsonb;
  v_prod_id uuid;
  v_cat_id uuid;
  v_item_price numeric;
  v_item_qty integer;
  v_item_total numeric;
  v_eligible_subtotal numeric := 0;
  v_is_eligible boolean := false;
  v_raw_discount numeric := 0;
  v_final_discount numeric := 0;
  v_user_order_count integer := 0;
  v_user_coupon_uses integer := 0;
BEGIN
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Coupon code is required');
  END IF;

  -- 1. Lookup coupon (case-insensitive)
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = UPPER(TRIM(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon code');
  END IF;

  -- 2. Check active flag
  IF NOT COALESCE(v_coupon.is_active, false) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon is no longer active');
  END IF;

  -- 3. Check validity dates (valid_from and valid_to)
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon promotion has not started yet');
  END IF;

  IF v_coupon.valid_to IS NOT NULL AND v_coupon.valid_to < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon has expired');
  END IF;

  -- 4. Check global max uses
  IF v_coupon.max_uses IS NOT NULL AND COALESCE(v_coupon.used_count, 0) >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon has reached its maximum usage limit');
  END IF;

  -- 5. First order only check
  IF COALESCE(v_coupon.first_order_only, false) THEN
    IF p_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_user_order_count
      FROM public.orders
      WHERE user_id = p_user_id
        AND status != 'cancelled';

      IF v_user_order_count > 0 THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This coupon is valid for first orders only');
      END IF;
    END IF;
  END IF;

  -- 6. Per-customer limit check
  IF v_coupon.per_customer_limit IS NOT NULL AND v_coupon.per_customer_limit > 0 AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_coupon_uses
    FROM public.orders
    WHERE user_id = p_user_id
      AND (coupon_code = v_coupon.code OR coupon_id = v_coupon.id)
      AND status != 'cancelled';

    IF v_user_coupon_uses >= v_coupon.per_customer_limit THEN
      RETURN jsonb_build_object('valid', false, 'error', 'You have already reached the redemption limit for this coupon');
    END IF;
  END IF;

  -- 7. Targeting scope evaluation
  IF v_coupon.applicable_to = 'all' OR v_coupon.applicable_to IS NULL THEN
    v_eligible_subtotal := COALESCE(p_subtotal, 0);
  ELSE
    -- Calculate eligible subtotal from matching items in cart
    IF jsonb_array_length(p_cart_items) = 0 THEN
      -- If cart items not supplied, fallback to subtotal but mark eligible
      v_eligible_subtotal := COALESCE(p_subtotal, 0);
    ELSE
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
      LOOP
        v_prod_id := NULL;
        v_cat_id := NULL;
        IF v_item ? 'product_id' THEN
          BEGIN
            v_prod_id := (v_item->>'product_id')::uuid;
          EXCEPTION WHEN OTHERS THEN
            v_prod_id := NULL;
          END;
        END IF;

        IF v_item ? 'category_id' AND v_item->>'category_id' IS NOT NULL THEN
          BEGIN
            v_cat_id := (v_item->>'category_id')::uuid;
          EXCEPTION WHEN OTHERS THEN
            v_cat_id := NULL;
          END;
        ELSIF v_prod_id IS NOT NULL THEN
          -- Resolve category from products table if not passed
          SELECT category_id INTO v_cat_id FROM public.products WHERE id = v_prod_id;
        END IF;

        v_item_price := COALESCE((v_item->>'price')::numeric, 0);
        v_item_qty := COALESCE((v_item->>'quantity')::integer, 1);
        v_item_total := v_item_price * v_item_qty;

        v_is_eligible := false;
        IF v_coupon.applicable_to = 'products' THEN
          IF v_prod_id IS NOT NULL AND v_prod_id = ANY(v_coupon.applicable_ids) THEN
            v_is_eligible := true;
          END IF;
        ELSIF v_coupon.applicable_to = 'categories' THEN
          IF v_cat_id IS NOT NULL AND v_cat_id = ANY(v_coupon.applicable_ids) THEN
            v_is_eligible := true;
          END IF;
        END IF;

        IF v_is_eligible THEN
          v_eligible_subtotal := v_eligible_subtotal + v_item_total;
        END IF;
      END LOOP;
    END IF;

    IF v_eligible_subtotal <= 0 THEN
      IF v_coupon.applicable_to = 'products' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This coupon is not applicable to any items in your cart');
      ELSE
        RETURN jsonb_build_object('valid', false, 'error', 'This coupon is only applicable to specific product categories');
      END IF;
    END IF;
  END IF;

  -- 8. Check minimum order value against subtotal
  IF v_coupon.min_order_value IS NOT NULL AND v_coupon.min_order_value > 0 THEN
    IF COALESCE(p_subtotal, 0) < v_coupon.min_order_value THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', format('Minimum order value of ₹%s required for this coupon', v_coupon.min_order_value)
      );
    END IF;
  END IF;

  -- 9. Compute discount amount
  IF v_coupon.discount_type = 'percentage' THEN
    v_raw_discount := ROUND((v_eligible_subtotal * v_coupon.discount_value / 100.0), 2);
    IF v_coupon.max_discount IS NOT NULL AND v_coupon.max_discount > 0 THEN
      v_final_discount := LEAST(v_raw_discount, v_coupon.max_discount);
    ELSE
      v_final_discount := v_raw_discount;
    END IF;
  ELSIF v_coupon.discount_type = 'fixed' THEN
    v_final_discount := LEAST(v_coupon.discount_value, v_eligible_subtotal);
  ELSIF v_coupon.discount_type = 'free_shipping' THEN
    v_final_discount := 0;
  ELSE
    v_final_discount := 0;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'max_discount', v_coupon.max_discount,
    'discount_amount', v_final_discount,
    'eligible_subtotal', v_eligible_subtotal,
    'free_shipping', (v_coupon.discount_type = 'free_shipping'),
    'min_order_value', v_coupon.min_order_value,
    'applicable_to', v_coupon.applicable_to,
    'display_title', v_coupon.display_title,
    'display_message', v_coupon.display_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric, jsonb, uuid) TO anon, authenticated;

-- 8. RPC: public.record_coupon_redemption
-- Atomically increments coupon used_count and binds coupon to order, preventing race conditions
CREATE OR REPLACE FUNCTION public.record_coupon_redemption(
  p_coupon_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_code text;
BEGIN
  -- Atomically increment used_count if below max_uses
  UPDATE public.coupons
  SET used_count = COALESCE(used_count, 0) + 1,
      updated_at = now()
  WHERE id = p_coupon_id
    AND (max_uses IS NULL OR COALESCE(used_count, 0) < max_uses)
  RETURNING code INTO v_code;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN false;
  END IF;

  -- Update order with coupon reference if order exists
  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET coupon_id = p_coupon_id,
        coupon_code = v_code,
        updated_at = now()
    WHERE id = p_order_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_coupon_redemption(uuid, uuid) TO authenticated, service_role;
