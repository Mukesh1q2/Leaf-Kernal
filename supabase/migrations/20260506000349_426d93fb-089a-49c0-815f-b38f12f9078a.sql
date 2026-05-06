
-- ============ SCHEMA EXTENSIONS ============
ALTER TABLE public.loyalty_balances
  ADD COLUMN IF NOT EXISTS lifetime_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_order ON public.loyalty_points(order_id);

-- ============ SEED SETTINGS ============
INSERT INTO public.site_settings (key, value) VALUES
  ('loyalty_signup_bonus', '50'),
  ('loyalty_earn_per_rupees', '10'),       -- 1 pt per ₹10
  ('loyalty_redeem_rate', '10'),           -- 10 pts = ₹1
  ('loyalty_review_bonus', '50'),
  ('loyalty_max_redeem_pct', '50'),        -- max % of order
  ('loyalty_tier_silver_min', '500'),
  ('loyalty_tier_gold_min', '2000'),
  ('loyalty_tier_silver_mult', '1.25'),
  ('loyalty_tier_gold_mult', '1.5')
ON CONFLICT (key) DO NOTHING;

-- ============ TIER HELPER ============
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id uuid)
RETURNS TABLE(tier text, multiplier numeric, lifetime integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lifetime int := 0;
  v_silver int; v_gold int;
  v_smult numeric; v_gmult numeric;
BEGIN
  SELECT COALESCE(lifetime_points,0) INTO v_lifetime FROM loyalty_balances WHERE user_id = p_user_id;
  SELECT (value)::int INTO v_silver FROM site_settings WHERE key='loyalty_tier_silver_min';
  SELECT (value)::int INTO v_gold   FROM site_settings WHERE key='loyalty_tier_gold_min';
  SELECT (value)::numeric INTO v_smult FROM site_settings WHERE key='loyalty_tier_silver_mult';
  SELECT (value)::numeric INTO v_gmult FROM site_settings WHERE key='loyalty_tier_gold_mult';
  IF v_lifetime >= COALESCE(v_gold,2000) THEN
    RETURN QUERY SELECT 'Gold'::text, COALESCE(v_gmult,1.5), v_lifetime;
  ELSIF v_lifetime >= COALESCE(v_silver,500) THEN
    RETURN QUERY SELECT 'Silver'::text, COALESCE(v_smult,1.25), v_lifetime;
  ELSE
    RETURN QUERY SELECT 'Bronze'::text, 1.0::numeric, v_lifetime;
  END IF;
END; $$;

-- ============ BALANCE MAINTENANCE ============
CREATE OR REPLACE FUNCTION public.update_loyalty_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO loyalty_balances (user_id, total_points, lifetime_points, updated_at)
  VALUES (
    NEW.user_id,
    NEW.points,
    GREATEST(NEW.points, 0),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = loyalty_balances.total_points + NEW.points,
    lifetime_points = loyalty_balances.lifetime_points + GREATEST(NEW.points, 0),
    updated_at = now();
  RETURN NEW;
END; $$;

-- need a unique constraint on user_id for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_balances_user_id_key'
  ) THEN
    ALTER TABLE public.loyalty_balances ADD CONSTRAINT loyalty_balances_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_loyalty_balance ON public.loyalty_points;
CREATE TRIGGER trg_loyalty_balance
AFTER INSERT ON public.loyalty_points
FOR EACH ROW EXECUTE FUNCTION public.update_loyalty_balance();

-- ============ NOTIFY ON LOYALTY CHANGE ============
CREATE OR REPLACE FUNCTION public.notify_loyalty_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.user_id,
    'loyalty',
    CASE WHEN NEW.type='earn' THEN '🎉 You earned ' || NEW.points || ' points!'
         ELSE '💰 ' || abs(NEW.points) || ' points redeemed' END,
    COALESCE(NEW.description, CASE WHEN NEW.type='earn' THEN 'Keep shopping to earn more.' ELSE 'Applied at checkout.' END),
    '/loyalty',
    jsonb_build_object('points', NEW.points, 'type', NEW.type, 'order_id', NEW.order_id)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_loyalty_notify ON public.loyalty_points;
CREATE TRIGGER trg_loyalty_notify
AFTER INSERT ON public.loyalty_points
FOR EACH ROW EXECUTE FUNCTION public.notify_loyalty_change();

-- ============ SIGNUP BONUS ============
CREATE OR REPLACE FUNCTION public.award_signup_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bonus int;
BEGIN
  SELECT (value)::int INTO v_bonus FROM site_settings WHERE key='loyalty_signup_bonus';
  IF COALESCE(v_bonus,0) > 0 THEN
    INSERT INTO loyalty_points (user_id, points, type, description)
    VALUES (NEW.user_id, v_bonus, 'earn', 'Welcome bonus 🎁');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_signup_bonus ON public.profiles;
CREATE TRIGGER trg_signup_bonus
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.award_signup_bonus();

-- ============ REVIEW BONUS ============
CREATE OR REPLACE FUNCTION public.award_review_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bonus int;
BEGIN
  IF (TG_OP='INSERT' AND NEW.is_approved=true)
     OR (TG_OP='UPDATE' AND NEW.is_approved=true AND COALESCE(OLD.is_approved,false)=false) THEN
    SELECT (value)::int INTO v_bonus FROM site_settings WHERE key='loyalty_review_bonus';
    IF COALESCE(v_bonus,0) > 0 THEN
      INSERT INTO loyalty_points (user_id, points, type, description)
      VALUES (NEW.user_id, v_bonus, 'earn', 'Thanks for your review ⭐');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_review_bonus ON public.reviews;
CREATE TRIGGER trg_review_bonus
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.award_review_bonus();

-- ============ ORDER LIFECYCLE: AWARD / REVOKE ============
CREATE OR REPLACE FUNCTION public.handle_order_loyalty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_per_rupees int;
  v_points int;
  v_mult numeric;
  v_already_awarded int;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Award on delivered
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    SELECT count(*) INTO v_already_awarded FROM loyalty_points
      WHERE order_id = NEW.id AND type='earn';
    IF v_already_awarded = 0 THEN
      SELECT (value)::int INTO v_per_rupees FROM site_settings WHERE key='loyalty_earn_per_rupees';
      SELECT multiplier INTO v_mult FROM get_user_tier(NEW.user_id);
      v_points := floor( (COALESCE(NEW.subtotal,0) / GREATEST(COALESCE(v_per_rupees,10),1)) * COALESCE(v_mult,1) );
      IF v_points > 0 THEN
        INSERT INTO loyalty_points (user_id, points, type, order_id, description)
        VALUES (NEW.user_id, v_points, 'earn', NEW.id,
                'Earned on order #' || substr(NEW.id::text,1,8));
      END IF;
    END IF;
  END IF;

  -- Revoke on cancellation/refund
  IF NEW.status IN ('cancelled','refunded') AND OLD.status NOT IN ('cancelled','refunded') THEN
    SELECT COALESCE(SUM(points),0) INTO v_points FROM loyalty_points
      WHERE order_id = NEW.id AND type='earn';
    IF v_points > 0 THEN
      INSERT INTO loyalty_points (user_id, points, type, order_id, description)
      VALUES (NEW.user_id, -v_points, 'redeem', NEW.id,
              'Reversed: order ' || NEW.status);
    END IF;
    -- restore redeemed points if any
    IF COALESCE(NEW.loyalty_points_redeemed,0) > 0 THEN
      INSERT INTO loyalty_points (user_id, points, type, order_id, description)
      VALUES (NEW.user_id, NEW.loyalty_points_redeemed, 'earn', NEW.id,
              'Refund: redeemed points returned');
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_loyalty ON public.orders;
CREATE TRIGGER trg_order_loyalty
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_loyalty();

-- ============ REDEEM RPC ============
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(p_points integer, p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance int;
  v_subtotal numeric;
  v_redeem_rate int;
  v_max_pct int;
  v_max_points int;
  v_discount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_points <= 0 THEN RAISE EXCEPTION 'Invalid points'; END IF;

  SELECT total_points INTO v_balance FROM loyalty_balances WHERE user_id = v_user;
  IF COALESCE(v_balance,0) < p_points THEN RAISE EXCEPTION 'Insufficient points'; END IF;

  SELECT subtotal INTO v_subtotal FROM orders WHERE id = p_order_id AND user_id = v_user;
  IF v_subtotal IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT (value)::int INTO v_redeem_rate FROM site_settings WHERE key='loyalty_redeem_rate';
  SELECT (value)::int INTO v_max_pct FROM site_settings WHERE key='loyalty_max_redeem_pct';
  v_max_points := floor( (v_subtotal * COALESCE(v_max_pct,50) / 100.0) * COALESCE(v_redeem_rate,10) );
  IF p_points > v_max_points THEN
    RAISE EXCEPTION 'Cannot redeem more than %% of order (max % points)', v_max_points;
  END IF;

  v_discount := round((p_points::numeric / GREATEST(COALESCE(v_redeem_rate,10),1))::numeric, 2);

  INSERT INTO loyalty_points (user_id, points, type, order_id, description)
  VALUES (v_user, -p_points, 'redeem', p_order_id, 'Redeemed at checkout');

  UPDATE orders SET
    loyalty_points_redeemed = COALESCE(loyalty_points_redeemed,0) + p_points,
    loyalty_discount = COALESCE(loyalty_discount,0) + v_discount,
    discount = COALESCE(discount,0) + v_discount,
    total = GREATEST(COALESCE(total,0) - v_discount, 0)
  WHERE id = p_order_id;

  RETURN jsonb_build_object('points', p_points, 'discount', v_discount);
END; $$;

-- ============ ADMIN ADJUST ============
CREATE OR REPLACE FUNCTION public.admin_adjust_loyalty(p_user_id uuid, p_points integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO loyalty_points (user_id, points, type, description)
  VALUES (p_user_id, p_points,
          CASE WHEN p_points >= 0 THEN 'earn' ELSE 'redeem' END,
          'Admin adjustment: ' || COALESCE(p_reason,''));
END; $$;
