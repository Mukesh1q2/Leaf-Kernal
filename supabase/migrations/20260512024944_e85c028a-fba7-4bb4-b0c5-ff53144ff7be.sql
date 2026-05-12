CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  cadence_days integer NOT NULL CHECK (cadence_days IN (15, 30, 60, 90)),
  discount_pct numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  next_charge_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_charge_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all subscriptions" ON public.subscriptions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_charge ON public.subscriptions(next_charge_at) WHERE status = 'active';

INSERT INTO public.site_settings (key, value)
VALUES ('subscription_default_discount_pct', '10')
ON CONFLICT (key) DO NOTHING;