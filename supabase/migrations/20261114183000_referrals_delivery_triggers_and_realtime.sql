-- Migration: Referrals claim RPC, delivery notifications trigger, referral reward trigger, and realtime publications

-- 1. claim_referral RPC: allows newly registered users to link their signup to a referrer's code
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_referrer_id uuid;
  v_clean_code text := upper(trim(COALESCE(p_code, '')));
  v_existing_ref_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is empty');
  END IF;

  -- Look up referrer by code
  SELECT user_id INTO v_referrer_id
  FROM public.referral_codes
  WHERE code = v_clean_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;

  -- Check if user was already linked to a referral
  SELECT id INTO v_existing_ref_id
  FROM public.referrals
  WHERE referred_user_id = v_user
  LIMIT 1;

  IF v_existing_ref_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already claimed a referral code');
  END IF;

  -- Get current user email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    v_email := 'user_' || substr(v_user::text, 1, 8) || '@leafandkernel.com';
  END IF;

  -- Check if a pending referral was previously recorded for this email with this referrer
  SELECT id INTO v_existing_ref_id
  FROM public.referrals
  WHERE referred_email = lower(v_email) AND referrer_id = v_referrer_id
  LIMIT 1;

  IF v_existing_ref_id IS NOT NULL THEN
    UPDATE public.referrals
    SET referred_user_id = v_user,
        status = 'completed'
    WHERE id = v_existing_ref_id;
  ELSE
    INSERT INTO public.referrals (referrer_id, referred_email, referred_user_id, referral_code, status, reward_given)
    VALUES (v_referrer_id, lower(v_email), v_user, v_clean_code, 'completed', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'code', v_clean_code);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;


-- 2. Delivery update trigger: syncs order status and dispatches customer notification
CREATE OR REPLACE FUNCTION public.handle_delivery_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_msg text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.carrier IS NOT DISTINCT FROM OLD.carrier AND NEW.tracking_id IS NOT DISTINCT FROM OLD.tracking_id THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id FROM public.orders WHERE id = NEW.order_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Synchronize orders table status
  IF NEW.status = 'delivered' THEN
    UPDATE public.orders SET status = 'delivered' WHERE id = NEW.order_id AND status <> 'delivered';
  ELSIF NEW.status = 'shipped' OR NEW.status = 'out_for_delivery' THEN
    UPDATE public.orders SET status = 'shipped' WHERE id = NEW.order_id AND status NOT IN ('shipped', 'delivered', 'cancelled');
  END IF;

  -- Determine notification title and text
  v_title := CASE NEW.status
    WHEN 'packed' THEN '📦 Order Packed'
    WHEN 'shipped' THEN '🚚 Order Shipped'
    WHEN 'out_for_delivery' THEN '🛵 Out for Delivery'
    WHEN 'delivered' THEN '✅ Order Delivered'
    WHEN 'returned' THEN '↩️ Order Returned'
    ELSE '📋 Delivery Status Update'
  END;

  v_msg := CASE NEW.status
    WHEN 'packed' THEN 'Your order #' || substr(NEW.order_id::text, 1, 8) || ' is packed and awaiting courier dispatch.'
    WHEN 'shipped' THEN 'Your order #' || substr(NEW.order_id::text, 1, 8) || ' is in transit via ' || COALESCE(NEW.carrier, 'courier') || CASE WHEN NEW.tracking_id IS NOT NULL THEN ' (Tracking: ' || NEW.tracking_id || ')' ELSE '' END || '.'
    WHEN 'out_for_delivery' THEN 'Your order #' || substr(NEW.order_id::text, 1, 8) || ' is out for delivery today!'
    WHEN 'delivered' THEN 'Your order #' || substr(NEW.order_id::text, 1, 8) || ' has been delivered. Thank you for choosing Leaf & Kernel!'
    WHEN 'returned' THEN 'Your order #' || substr(NEW.order_id::text, 1, 8) || ' has been marked as returned.'
    ELSE 'Status updated to ' || replace(NEW.status, '_', ' ') || '.'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    v_user_id,
    'delivery',
    v_title,
    v_msg,
    '/track/' || NEW.order_id,
    jsonb_build_object(
      'order_id', NEW.order_id,
      'status', NEW.status,
      'carrier', NEW.carrier,
      'tracking_id', NEW.tracking_id,
      'estimated_delivery', NEW.estimated_delivery
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_update ON public.deliveries;
CREATE TRIGGER trg_delivery_update
AFTER INSERT OR UPDATE OF status, tracking_id, carrier, estimated_delivery ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.handle_delivery_update();


-- 3. Referral reward trigger: awards referrer points when referred user's first order is delivered
CREATE OR REPLACE FUNCTION public.handle_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref record;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only trigger when order is confirmed or delivered
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    SELECT * INTO v_ref
    FROM public.referrals
    WHERE referred_user_id = NEW.user_id AND reward_given = false
    LIMIT 1;

    IF v_ref.id IS NOT NULL THEN
      -- Mark reward as given
      UPDATE public.referrals
      SET reward_given = true
      WHERE id = v_ref.id;

      -- Award 100 points to referrer
      INSERT INTO public.loyalty_points (user_id, points, type, order_id, description)
      VALUES (
        v_ref.referrer_id,
        100,
        'earn',
        NEW.id,
        'Referral reward: friend completed order #' || substr(NEW.id::text, 1, 8)
      );

      -- Notify referrer
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_ref.referrer_id,
        'loyalty',
        '🎉 Referral Bonus: +100 Points!',
        'A friend you referred completed their order! 100 points have been added to your wellness balance.',
        '/account',
        jsonb_build_object('order_id', NEW.id, 'points', 100, 'referred_user_id', NEW.user_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_order_reward ON public.orders;
CREATE TRIGGER trg_referral_order_reward
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_referral_reward();


-- 4. Abandoned cart tracking RPC and auto-recovery trigger
CREATE OR REPLACE FUNCTION public.sync_abandoned_cart(p_snapshot jsonb, p_total numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  -- Look for existing active (unrecovered) abandoned cart record for this user in last 24h
  SELECT id INTO v_id
  FROM public.abandoned_carts
  WHERE user_id = v_user AND recovered = false AND created_at > now() - interval '24 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.abandoned_carts
    SET cart_snapshot = p_snapshot,
        cart_total = p_total,
        updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.abandoned_carts (user_id, cart_snapshot, cart_total, recovered)
    VALUES (v_user, p_snapshot, p_total, false)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_abandoned_cart(jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_abandoned_cart(jsonb, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_abandoned_cart_recovered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed') THEN
    UPDATE public.abandoned_carts
    SET recovered = true, updated_at = now()
    WHERE user_id = NEW.user_id AND recovered = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_recovered_cart ON public.orders;
CREATE TRIGGER trg_order_recovered_cart
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.mark_abandoned_cart_recovered();


-- 5. Enable Supabase Realtime for orders and deliveries
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
