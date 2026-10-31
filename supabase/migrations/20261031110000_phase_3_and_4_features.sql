-- ==============================================================================
-- Migration: Phase 3 & Phase 4 Features
-- 1. Real Newsletter Capture (newsletter_subscribers table + RLS)
-- 2. Guest Order Tracking RPC (track_order_public)
-- 3. Persistent Chat Rate Limiting (rate_limit_buckets + check_rate_limit RPC)
-- ==============================================================================

-- 1. Real Newsletter Capture
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT DEFAULT 'website_footer',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_lower_email
  ON public.newsletter_subscribers (lower(email));

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscribers'
      AND policyname = 'Allow public insert to newsletter_subscribers'
  ) THEN
    CREATE POLICY "Allow public insert to newsletter_subscribers"
      ON public.newsletter_subscribers
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscribers'
      AND policyname = 'Allow staff to view newsletter_subscribers'
  ) THEN
    CREATE POLICY "Allow staff to view newsletter_subscribers"
      ON public.newsletter_subscribers
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.is_master_admin(auth.uid())
        OR public.has_role(auth.uid(), 'content_manager'::app_role)
      );
  END IF;
END $$;

-- 2. Guest Order Tracking RPC
CREATE OR REPLACE FUNCTION public.track_order_public(
  p_order_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_norm_email TEXT;
  v_order RECORD;
  v_delivery RECORD;
  v_items_count INTEGER;
  v_result JSONB;
BEGIN
  IF p_order_id IS NULL OR p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  v_norm_email := lower(trim(p_email));

  -- Find matching order where ID matches AND either:
  -- 1. address_snapshot->>'email' matches, OR
  -- 2. user's auth email matches
  SELECT o.id, o.status, o.total, o.created_at, o.address_snapshot
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      lower(trim(COALESCE(o.address_snapshot->>'email', ''))) = v_norm_email
      OR lower(trim(COALESCE((SELECT u.email FROM auth.users u WHERE u.id = o.user_id), ''))) = v_norm_email
    );

  IF NOT FOUND THEN
    -- Return NULL to prevent enumeration
    RETURN NULL;
  END IF;

  -- Get associated delivery record
  SELECT d.carrier, d.tracking_id, d.status AS delivery_status, d.estimated_delivery, d.timeline, d.notes
  INTO v_delivery
  FROM public.deliveries d
  WHERE d.order_id = p_order_id;

  -- Count items in order
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_items_count
  FROM public.order_items
  WHERE order_id = p_order_id;

  v_result := jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'total', v_order.total,
    'items_count', v_items_count,
    'recipient_name', COALESCE(v_order.address_snapshot->>'name', 'Customer'),
    'shipping_city', COALESCE(v_order.address_snapshot->>'city', ''),
    'shipping_state', COALESCE(v_order.address_snapshot->>'state', ''),
    'carrier', v_delivery.carrier,
    'tracking_id', v_delivery.tracking_id,
    'delivery_status', COALESCE(v_delivery.delivery_status, 'placed'),
    'estimated_delivery', v_delivery.estimated_delivery,
    'timeline', COALESCE(v_delivery.timeline, '[]'::jsonb),
    'notes', v_delivery.notes
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_order_public(UUID, TEXT) TO anon, authenticated;

-- 3. Persistent Chat Rate Limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER DEFAULT 20,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_interval INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
  v_count INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Clean up expired buckets periodically (5% chance)
  IF random() < 0.05 THEN
    DELETE FROM public.rate_limit_buckets
    WHERE window_start < (v_now - INTERVAL '1 hour');
  END IF;

  -- Atomically insert or update the rate limit window
  INSERT INTO public.rate_limit_buckets (key, request_count, window_start, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    request_count = CASE
      WHEN public.rate_limit_buckets.window_start + v_window_interval < v_now THEN 1
      ELSE public.rate_limit_buckets.request_count + 1
    END,
    window_start = CASE
      WHEN public.rate_limit_buckets.window_start + v_window_interval < v_now THEN v_now
      ELSE public.rate_limit_buckets.window_start
    END,
    updated_at = v_now
  RETURNING request_count INTO v_count;

  v_allowed := (v_count <= p_max_requests);
  RETURN v_allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;
