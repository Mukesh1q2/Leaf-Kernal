-- ==============================================================================
-- Migration: CMS & Storefront Controls, Atomic Bundles, and Reference Integrity
-- Date: 2026-11-04
--
-- Features:
-- 1. Atomic Bundle Save & Replace RPC (save_bundle_atomic)
-- 2. Entity Reference Checker RPC (check_entity_references)
-- 3. Expanded Site Settings Whitelist Policy for Storefront Display
-- ==============================================================================

-- 1. Atomic Bundle Save & Replace
CREATE OR REPLACE FUNCTION public.save_bundle_atomic(
  p_bundle_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_image_url text,
  p_bundle_price numeric,
  p_original_total numeric,
  p_is_active boolean,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_item jsonb;
  v_prod_id uuid;
  v_qty int;
  v_result jsonb;
BEGIN
  -- Permission check: caller must have CMS access
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'editor'::app_role) OR
    public.has_role(auth.uid(), 'content_manager'::app_role) OR
    public.has_role(auth.uid(), 'inventory_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to manage product bundles.';
  END IF;

  -- Validate inputs
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Bundle name is required.';
  END IF;

  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RAISE EXCEPTION 'Bundle slug is required.';
  END IF;

  IF p_bundle_price IS NULL OR p_bundle_price < 0 THEN
    RAISE EXCEPTION 'Bundle price must be non-negative.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A bundle must include at least one product item.';
  END IF;

  -- Update or Insert bundle
  IF p_bundle_id IS NOT NULL THEN
    UPDATE public.product_bundles
    SET
      name = trim(p_name),
      slug = trim(lower(p_slug)),
      description = p_description,
      image_url = p_image_url,
      bundle_price = p_bundle_price,
      original_total = COALESCE(p_original_total, 0),
      is_active = COALESCE(p_is_active, true),
      updated_at = now()
    WHERE id = p_bundle_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Bundle with id % does not exist.', p_bundle_id;
    END IF;
  ELSE
    INSERT INTO public.product_bundles (
      name,
      slug,
      description,
      image_url,
      bundle_price,
      original_total,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      trim(p_name),
      trim(lower(p_slug)),
      p_description,
      p_image_url,
      p_bundle_price,
      COALESCE(p_original_total, 0),
      COALESCE(p_is_active, true),
      now(),
      now()
    )
    RETURNING id INTO v_id;
  END IF;

  -- Replace bundle items atomically within this transaction
  DELETE FROM public.bundle_items WHERE bundle_id = v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::uuid;
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    -- Verify product exists
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_prod_id) THEN
      RAISE EXCEPTION 'Referenced product % does not exist in catalog.', v_prod_id;
    END IF;

    INSERT INTO public.bundle_items (bundle_id, product_id, quantity)
    VALUES (v_id, v_prod_id, v_qty);
  END LOOP;

  SELECT to_jsonb(b) INTO v_result
  FROM public.product_bundles b
  WHERE b.id = v_id;

  RETURN v_result;
END;
$$;

-- 2. Entity Reference Checker for Safe Deletions
CREATE OR REPLACE FUNCTION public.check_entity_references(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orders_count int := 0;
  v_bundles_count int := 0;
  v_products_count int := 0;
  v_subcats_count int := 0;
  v_concerns_count int := 0;
  v_can_delete boolean := true;
  v_message text := '';
BEGIN
  IF p_entity_type = 'product' THEN
    -- Check order history
    SELECT count(*) INTO v_orders_count
    FROM public.order_items
    WHERE product_id = p_entity_id;

    -- Check bundle references
    SELECT count(*) INTO v_bundles_count
    FROM public.bundle_items
    WHERE product_id = p_entity_id;

    IF v_orders_count > 0 THEN
      v_can_delete := false;
      v_message := format('Product has %s customer order(s) and cannot be deleted to preserve order history. Please deactivate it instead.', v_orders_count);
    ELSIF v_bundles_count > 0 THEN
      v_can_delete := false;
      v_message := format('Product is included in %s bundle(s). Please remove it from all bundles before deleting.', v_bundles_count);
    ELSE
      v_message := 'Product has no historical orders or bundle links and can be safely deleted.';
    END IF;

    RETURN jsonb_build_object(
      'can_delete', v_can_delete,
      'order_count', v_orders_count,
      'bundle_count', v_bundles_count,
      'message', v_message
    );

  ELSIF p_entity_type = 'category' THEN
    SELECT count(*) INTO v_products_count
    FROM public.products
    WHERE category_id = p_entity_id;

    SELECT count(*) INTO v_subcats_count
    FROM public.categories
    WHERE parent_id = p_entity_id;

    IF v_products_count > 0 OR v_subcats_count > 0 THEN
      v_can_delete := false;
      v_message := format('Category has %s assigned product(s) and %s subcategory/subcategories.', v_products_count, v_subcats_count);
    ELSE
      v_message := 'Category is not referenced by any products or subcategories and can be safely deleted.';
    END IF;

    RETURN jsonb_build_object(
      'can_delete', v_can_delete,
      'product_count', v_products_count,
      'subcategory_count', v_subcats_count,
      'message', v_message
    );

  ELSIF p_entity_type = 'health_concern' THEN
    SELECT count(*) INTO v_concerns_count
    FROM public.product_health_concerns
    WHERE concern_id = p_entity_id;

    IF v_concerns_count > 0 THEN
      v_can_delete := false;
      v_message := format('Health concern is linked to %s product(s). Please unlink before deleting.', v_concerns_count);
    ELSE
      v_message := 'Health concern is not linked to any products and can be safely deleted.';
    END IF;

    RETURN jsonb_build_object(
      'can_delete', v_can_delete,
      'product_count', v_concerns_count,
      'message', v_message
    );

  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
  END IF;
END;
$$;

-- 3. Expanded Site Settings Whitelist Policy for Public Storefront
DROP POLICY IF EXISTS "Public non-sensitive settings are readable" ON public.site_settings;
CREATE POLICY "Public non-sensitive settings are readable"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (key IN (
  'store_name', 'store_tagline', 'free_shipping_threshold', 'cod_enabled', 'cod_fee',
  'instagram_url', 'facebook_url', 'youtube_url', 'twitter_url', 'x_url',
  'seo_default_description', 'seo_title_template',
  'maintenance_mode', 'subscription_default_discount_pct',
  'loyalty_earn_per_rupees', 'loyalty_max_redeem_pct', 'loyalty_redeem_rate',
  'loyalty_review_bonus', 'loyalty_signup_bonus',
  'loyalty_tier_gold_min', 'loyalty_tier_gold_mult',
  'loyalty_tier_silver_min', 'loyalty_tier_silver_mult',
  'fssai_number', 'gstin',
  'contact_email', 'support_phone', 'whatsapp_number', 'business_address',
  'hero_headline', 'hero_subtitle', 'hero_cta_text', 'hero_cta_link',
  'quality_statement', 'stat_plant_based', 'stat_heritage', 'stat_quality', 'stat_delivery'
));

-- 4. Permissions
GRANT EXECUTE ON FUNCTION public.save_bundle_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_entity_references TO authenticated;

