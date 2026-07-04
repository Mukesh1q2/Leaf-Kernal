
-- 1) notifications INSERT self-only
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2) coupons: keep RLS, restrict column privileges
DROP POLICY IF EXISTS "Active coupons are public" ON public.coupons;
CREATE POLICY "Active coupon codes are public"
ON public.coupons
FOR SELECT
TO anon, authenticated
USING (is_active = true AND (valid_to IS NULL OR valid_to > now()));

REVOKE SELECT ON public.coupons FROM anon, authenticated;
GRANT SELECT (id, code, discount_type, discount_value, min_order_value, valid_from, valid_to, is_active, applicable_to)
  ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;

-- 3) site_settings whitelist
DROP POLICY IF EXISTS "Settings are public read" ON public.site_settings;
CREATE POLICY "Public non-sensitive settings are readable"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (key IN (
  'store_name','store_tagline','free_shipping_threshold','cod_enabled','cod_fee',
  'instagram_url','facebook_url','youtube_url','seo_default_description','seo_title_template',
  'maintenance_mode','subscription_default_discount_pct',
  'loyalty_earn_per_rupees','loyalty_max_redeem_pct','loyalty_redeem_rate',
  'loyalty_review_bonus','loyalty_signup_bonus',
  'loyalty_tier_gold_min','loyalty_tier_gold_mult',
  'loyalty_tier_silver_min','loyalty_tier_silver_mult',
  'fssai_number','gstin',
  'contact_email','support_phone','whatsapp_number'
));

-- 4) chat_conversations: drop anon SELECT (leaked all anon conversations)
DROP POLICY IF EXISTS "Anon read own session conversation" ON public.chat_conversations;

-- 5) storage: drop broad public SELECT on product-images (public URLs still work via CDN)
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

-- 6) revoke EXECUTE on SECURITY DEFINER helpers not meant to be client-callable
REVOKE EXECUTE ON FUNCTION public.notify_loyalty_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.award_review_bonus() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.award_signup_bonus() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_order_loyalty() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_delivery_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_price_drop() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_loyalty_balance() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_loyalty(uuid, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_tier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_points(integer, uuid) FROM anon;
