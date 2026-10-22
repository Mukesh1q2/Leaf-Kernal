
-- 1. Tighten RLS: prevent client-side privilege escalation
DROP POLICY IF EXISTS "System insert loyalty points" ON public.loyalty_points;
DROP POLICY IF EXISTS "System upsert loyalty balance" ON public.loyalty_balances;
DROP POLICY IF EXISTS "System update loyalty balance" ON public.loyalty_balances;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System insert referral" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can insert activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users create own reviews" ON public.reviews;

-- 2. user_activity: allow inserts only when user_id matches auth uid (or both null for anon)
CREATE POLICY "Insert own activity"
ON public.user_activity FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

-- 3. reviews: require verified delivered purchase, one review per product per user
CREATE POLICY "Verified purchasers create one review"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
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

-- 4. Server-side referral creation (SECURITY DEFINER, invoker-scoped checks)
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_referral_code_key;

CREATE OR REPLACE FUNCTION public.create_referral(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_code text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_email IS NULL OR position('@' in p_email) = 0 THEN RAISE EXCEPTION 'Invalid email'; END IF;

  -- Ensure the referrer has a referral code; generate one if missing
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_user;
  IF v_code IS NULL THEN
    v_code := 'LK' || upper(substr(replace(v_user::text, '-', ''), 1, 6));
    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (v_user, v_code)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN unique_violation THEN
      v_code := 'LK' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (v_user, v_code)
      ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code;
    END;
    SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_user;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_email, referral_code, status, reward_given)
  VALUES (v_user, lower(p_email), v_code, 'pending', false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_referral(text) TO authenticated;

-- 5. Convert recommendation helpers to SECURITY INVOKER where possible
CREATE OR REPLACE FUNCTION public.get_frequently_bought_together(p_product_id uuid, p_limit integer DEFAULT 4)
RETURNS SETOF products
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.* FROM public.products p
  JOIN (
    SELECT oi2.product_id, COUNT(*) AS freq
    FROM public.order_items oi1
    JOIN public.order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id <> oi2.product_id
    WHERE oi1.product_id = p_product_id
    GROUP BY oi2.product_id
    ORDER BY freq DESC
    LIMIT 20
  ) s ON s.product_id = p.id
  WHERE p.is_active = true
  ORDER BY s.freq DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_recommended_products(p_user_id uuid, p_limit integer DEFAULT 8)
RETURNS SETOF products
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT product_id FROM public.user_activity
    WHERE user_id = p_user_id AND product_id IS NOT NULL
      AND created_at > now() - interval '60 days'
    ORDER BY created_at DESC LIMIT 30
  ),
  cats AS (
    SELECT DISTINCT category_id FROM public.products WHERE id IN (SELECT product_id FROM recent)
  ),
  concerns AS (
    SELECT DISTINCT concern_id FROM public.product_health_concerns
    WHERE product_id IN (SELECT product_id FROM recent)
  )
  SELECT p.* FROM public.products p
  WHERE p.is_active = true
    AND p.id NOT IN (SELECT product_id FROM recent)
    AND (
      p.category_id IN (SELECT category_id FROM cats)
      OR EXISTS (
        SELECT 1 FROM public.product_health_concerns phc
        WHERE phc.product_id = p.id AND phc.concern_id IN (SELECT concern_id FROM concerns)
      )
    )
  ORDER BY p.rating DESC NULLS LAST, p.review_count DESC NULLS LAST
  LIMIT p_limit;
$$;

-- 6. Lock down remaining SECURITY DEFINER helpers so anon cannot execute them
REVOKE EXECUTE ON FUNCTION public.get_user_tier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_points(integer, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_loyalty(uuid, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_loyalty(uuid, integer, text) TO service_role;
