-- ==============================================================================
-- Migration: Unify has_role to single canonical has_role(uuid, app_role) function
-- Drops policies depending on the temporary text overload, drops the text overload,
-- and recreates the policies pointing to public.has_role(uuid, app_role).
-- ==============================================================================

-- 1. Temporarily drop the 11 policies depending on has_role(uuid, text)
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and editors manage blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and editors manage banners" ON public.banners;
DROP POLICY IF EXISTS "Admins and editors manage faqs" ON public.faqs;
DROP POLICY IF EXISTS "Admins and editors manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins and editors can update products" ON public.products;

-- 2. Drop the text overload now that nothing depends on it
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role text);

-- 3. Recreate the policies using canonical public.has_role(uuid, app_role)
-- User roles
CREATE POLICY "Admins can view user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (
    (is_master = false AND role != 'admin'::app_role)
    OR public.is_master_admin(auth.uid())
  )
);

CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (
    (is_master = false AND role != 'admin'::app_role)
    OR public.is_master_admin(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (
    (is_master = false AND role != 'admin'::app_role)
    OR public.is_master_admin(auth.uid())
  )
);

CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (
    (is_master = false AND role != 'admin'::app_role)
    OR public.is_master_admin(auth.uid())
  )
);

-- Blog posts
CREATE POLICY "Admins and editors manage blog posts"
ON public.blog_posts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

-- Banners
CREATE POLICY "Admins and editors manage banners"
ON public.banners FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

-- FAQs
CREATE POLICY "Admins and editors manage faqs"
ON public.faqs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

-- Testimonials
CREATE POLICY "Admins and editors manage testimonials"
ON public.testimonials FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

-- Products
CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and editors can update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

-- Update trigger function to use app_role
CREATE OR REPLACE FUNCTION public.enforce_editor_product_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'editor'::app_role) AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Editors are not permitted to change product ID.';
    END IF;
    IF NEW.price IS DISTINCT FROM OLD.price THEN
      RAISE EXCEPTION 'Editors are not permitted to change product price.';
    END IF;
    IF NEW.original_price IS DISTINCT FROM OLD.original_price THEN
      RAISE EXCEPTION 'Editors are not permitted to change product original_price.';
    END IF;
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
      RAISE EXCEPTION 'Editors are not permitted to change product inventory (stock_quantity).';
    END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN
      RAISE EXCEPTION 'Editors are not permitted to modify product rating.';
    END IF;
    IF NEW.review_count IS DISTINCT FROM OLD.review_count THEN
      RAISE EXCEPTION 'Editors are not permitted to modify product review_count.';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Editors are not permitted to change product activation state (is_active).';
    END IF;
    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION 'Editors are not permitted to change product featured status (is_featured).';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Editors are not permitted to change product created_at timestamp.';
    END IF;
    IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      RAISE EXCEPTION 'Editors are not permitted to change product updated_at timestamp.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
