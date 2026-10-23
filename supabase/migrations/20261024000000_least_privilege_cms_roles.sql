-- ==============================================================================
-- Migration: Least-Privilege Role Authorization & RLS for CMS Staff Roles
-- Roles: admin, editor, content_manager, inventory_manager, customer_support, moderator, user
-- Preserves Master Admin safeguards and isolates storefront 'user' accounts.
-- ==============================================================================

-- 1. Update has_cms_access to recognize all 6 staff roles
CREATE OR REPLACE FUNCTION public.has_cms_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN (
      'admin',
      'editor',
      'content_manager',
      'inventory_manager',
      'customer_support',
      'moderator'
    )
  );
$$;

-- 2. Orders Policies: Allow customer_support to view and update orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'customer_support')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'customer_support')
);

-- 3. Order Items Policies: Allow customer_support to view order items
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can view all order items" ON public.order_items;
CREATE POLICY "Staff can view all order items"
ON public.order_items FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'customer_support')
  OR EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);

-- 4. Deliveries Policies: Allow inventory_manager & customer_support to view and update
DROP POLICY IF EXISTS "Admins manage deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Staff can view deliveries" ON public.deliveries;
CREATE POLICY "Staff can view deliveries"
ON public.deliveries FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
  OR public.has_role(auth.uid(), 'customer_support')
  OR EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = deliveries.order_id AND orders.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff can update deliveries" ON public.deliveries;
CREATE POLICY "Staff can update deliveries"
ON public.deliveries FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
  OR public.has_role(auth.uid(), 'customer_support')
);

DROP POLICY IF EXISTS "Admins can insert deliveries" ON public.deliveries;
CREATE POLICY "Staff can insert deliveries"
ON public.deliveries FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
);

-- 5. Reviews Policies: Allow moderators & customer_support to view all reviews and moderators to update
DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
DROP POLICY IF EXISTS "Staff can view all reviews" ON public.reviews;
CREATE POLICY "Staff can view all reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (
  is_approved = true
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
  OR public.has_role(auth.uid(), 'customer_support')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Moderators can update reviews" ON public.reviews;
CREATE POLICY "Moderators can update reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;
CREATE POLICY "Admins can delete reviews"
ON public.reviews FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- 6. Contact Inquiries Policies: Allow customer_support and moderators to view and respond
DROP POLICY IF EXISTS "Admins can manage inquiries" ON public.contact_inquiries;
DROP POLICY IF EXISTS "Staff can view inquiries" ON public.contact_inquiries;
CREATE POLICY "Staff can view inquiries"
ON public.contact_inquiries FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'customer_support')
  OR public.has_role(auth.uid(), 'moderator')
);

DROP POLICY IF EXISTS "Staff can update inquiries" ON public.contact_inquiries;
CREATE POLICY "Staff can update inquiries"
ON public.contact_inquiries FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'customer_support')
  OR public.has_role(auth.uid(), 'moderator')
);

-- 7. Serviceable Pincodes Policies: Allow inventory_manager to manage pincodes
DROP POLICY IF EXISTS "Admins manage pincodes" ON public.serviceable_pincodes;
DROP POLICY IF EXISTS "Staff manage pincodes" ON public.serviceable_pincodes;
CREATE POLICY "Staff manage pincodes"
ON public.serviceable_pincodes FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
);

-- 8. Product Bundles & Bundle Items: Allow inventory_manager and content_manager
DROP POLICY IF EXISTS "Admins manage bundles" ON public.product_bundles;
DROP POLICY IF EXISTS "Staff manage bundles" ON public.product_bundles;
CREATE POLICY "Staff manage bundles"
ON public.product_bundles FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
);

DROP POLICY IF EXISTS "Admins manage bundle items" ON public.bundle_items;
DROP POLICY IF EXISTS "Staff manage bundle items" ON public.bundle_items;
CREATE POLICY "Staff manage bundle items"
ON public.bundle_items FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
);

-- 9. Abandoned Carts: Allow customer_support to view
DROP POLICY IF EXISTS "Admins manage abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Staff manage abandoned carts" ON public.abandoned_carts;
CREATE POLICY "Staff manage abandoned carts"
ON public.abandoned_carts FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'customer_support')
);

-- 10. Categories & Health Concerns: Allow content_manager alongside editor and admin
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can manage categories" ON public.categories;
CREATE POLICY "Staff can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
);

DROP POLICY IF EXISTS "Admins can manage health concerns" ON public.health_concerns;
DROP POLICY IF EXISTS "Staff can manage health concerns" ON public.health_concerns;
CREATE POLICY "Staff can manage health concerns"
ON public.health_concerns FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
);

-- 11. Product Updates: Allow inventory_manager and content_manager
DROP POLICY IF EXISTS "Admins and editors can update products" ON public.products;
DROP POLICY IF EXISTS "Staff can update products" ON public.products;
CREATE POLICY "Staff can update products"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
  OR public.has_role(auth.uid(), 'inventory_manager')
);

-- Trigger: Enforce granular field restrictions based on role
CREATE OR REPLACE FUNCTION public.enforce_editor_product_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If full admin, allow all modifications
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- 1. Inventory Manager restrictions: can ONLY modify stock_quantity
  IF public.has_role(auth.uid(), 'inventory_manager') AND 
     NOT (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'content_manager')) THEN
    IF NEW.name IS DISTINCT FROM OLD.name OR
       NEW.slug IS DISTINCT FROM OLD.slug OR
       NEW.price IS DISTINCT FROM OLD.price OR
       NEW.original_price IS DISTINCT FROM OLD.original_price OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.short_description IS DISTINCT FROM OLD.short_description OR
       NEW.image_url IS DISTINCT FROM OLD.image_url OR
       NEW.category_id IS DISTINCT FROM OLD.category_id OR
       NEW.rating IS DISTINCT FROM OLD.rating OR
       NEW.review_count IS DISTINCT FROM OLD.review_count OR
       NEW.is_active IS DISTINCT FROM OLD.is_active OR
       NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION 'Inventory managers may only modify stock quantities.';
    END IF;
  END IF;

  -- 2. Editor & Content Manager restrictions: cannot modify prices, inventory, rating, or status flags
  IF (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'content_manager')) AND
     NOT public.has_role(auth.uid(), 'inventory_manager') THEN
    IF NEW.price IS DISTINCT FROM OLD.price THEN
      RAISE EXCEPTION 'Content editors are not permitted to change product price.';
    END IF;
    IF NEW.original_price IS DISTINCT FROM OLD.original_price THEN
      RAISE EXCEPTION 'Content editors are not permitted to change product original_price.';
    END IF;
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
      RAISE EXCEPTION 'Content editors are not permitted to change product inventory. Use the inventory management workflow.';
    END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating OR NEW.review_count IS DISTINCT FROM OLD.review_count THEN
      RAISE EXCEPTION 'Product ratings are managed automatically by the customer review engine.';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION 'Content editors are not permitted to alter product store activation status.';
    END IF;
  END IF;

  -- Protect Primary Key and Created timestamp across all non-admins
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Product ID cannot be changed.';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Created timestamp cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;
