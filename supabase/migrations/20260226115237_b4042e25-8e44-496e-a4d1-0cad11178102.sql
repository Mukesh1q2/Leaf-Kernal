
-- Extend app_role enum with new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inventory_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_support';

-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_value numeric DEFAULT 0,
  max_uses integer DEFAULT NULL,
  used_count integer DEFAULT 0,
  per_customer_limit integer DEFAULT 1,
  valid_from timestamptz DEFAULT now(),
  valid_to timestamptz DEFAULT NULL,
  is_active boolean DEFAULT true,
  first_order_only boolean DEFAULT false,
  applicable_to text DEFAULT 'all' CHECK (applicable_to IN ('all', 'categories', 'products')),
  applicable_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Active coupons are public" ON public.coupons FOR SELECT USING (is_active = true AND (valid_to IS NULL OR valid_to > now()));

-- Banners table
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  cta_text text DEFAULT 'Shop Now',
  cta_link text DEFAULT '/shop',
  bg_color text DEFAULT '#1A4D2E',
  position text DEFAULT 'hero' CHECK (position IN ('hero', 'announcement', 'popup', 'promo')),
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage banners" ON public.banners FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Active banners are public" ON public.banners FOR SELECT USING (is_active = true);

-- Site settings (key-value store)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Settings are public read" ON public.site_settings FOR SELECT USING (true);

-- Admin activity log
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view activity log" ON public.admin_activity_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert activity log" ON public.admin_activity_log FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Testimonials table (separate from reviews)
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  product text,
  quote text NOT NULL,
  photo_url text,
  rating integer DEFAULT 5,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage testimonials" ON public.testimonials FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Active testimonials are public" ON public.testimonials FOR SELECT USING (is_active = true);

-- Add triggers for updated_at
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('store_name', 'Leaf & Kernel Superfoods'),
  ('store_tagline', 'Plant-Powered Nutrition from India'),
  ('contact_email', 'hello@leafandkernel.com'),
  ('support_phone', '+91 98765 43210'),
  ('whatsapp_number', '+91 98765 43210'),
  ('business_address', 'Mumbai, Maharashtra, India'),
  ('fssai_number', ''),
  ('gstin', ''),
  ('free_shipping_threshold', '999'),
  ('cod_enabled', 'true'),
  ('cod_fee', '0'),
  ('maintenance_mode', 'false'),
  ('instagram_url', ''),
  ('facebook_url', ''),
  ('youtube_url', ''),
  ('seo_title_template', '{page} | Leaf & Kernel Superfoods'),
  ('seo_default_description', 'Premium Ayurvedic superfoods and plant-based nutrition from India.');
