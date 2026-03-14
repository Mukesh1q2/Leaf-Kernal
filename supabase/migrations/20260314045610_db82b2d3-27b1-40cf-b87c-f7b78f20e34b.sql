
-- Scheduled publishing: add scheduled_at to blog_posts and banners
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS starts_at timestamptz DEFAULT NULL;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS ends_at timestamptz DEFAULT NULL;

-- Product Bundles
CREATE TABLE IF NOT EXISTS public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  image_url text,
  original_total numeric NOT NULL DEFAULT 0,
  bundle_price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid REFERENCES public.product_bundles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity integer DEFAULT 1
);

-- Abandoned cart tracking
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cart_snapshot jsonb NOT NULL DEFAULT '[]',
  cart_total numeric DEFAULT 0,
  recovered boolean DEFAULT false,
  recovery_email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Loyalty points
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'earn',
  description text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_balances (
  user_id uuid PRIMARY KEY NOT NULL,
  total_points integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Referral program
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_email text NOT NULL,
  referred_user_id uuid,
  referral_code text UNIQUE NOT NULL,
  status text DEFAULT 'pending',
  reward_given boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id uuid PRIMARY KEY NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Public read for bundles
CREATE POLICY "Anyone can read active bundles" ON public.product_bundles FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read bundle items" ON public.bundle_items FOR SELECT USING (true);

-- Admin full access for bundles
CREATE POLICY "Admins manage bundles" ON public.product_bundles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage bundle items" ON public.bundle_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Users see own data
CREATE POLICY "Users read own abandoned carts" ON public.abandoned_carts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own loyalty points" ON public.loyalty_points FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own loyalty balance" ON public.loyalty_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "Users read own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin full access for new tables
CREATE POLICY "Admins manage abandoned carts" ON public.abandoned_carts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage loyalty points" ON public.loyalty_points FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage loyalty balances" ON public.loyalty_balances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage referral codes" ON public.referral_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts for system operations
CREATE POLICY "System insert abandoned carts" ON public.abandoned_carts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System insert loyalty points" ON public.loyalty_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System upsert loyalty balance" ON public.loyalty_balances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System update loyalty balance" ON public.loyalty_balances FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System insert referral code" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System insert referral" ON public.referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);
