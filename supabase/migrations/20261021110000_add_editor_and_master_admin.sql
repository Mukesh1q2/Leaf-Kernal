-- ==============================================================================
-- Migration: Add 'editor' role, update master admin permissions, and RLS policies
-- ==============================================================================

-- 1. Add 'editor' to app_role enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'app_role' AND pg_enum.enumlabel = 'editor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'editor';
  END IF;
END $$;

-- 2. Ensure is_master column exists on user_roles and is restricted to admin role
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_master_requires_admin_check'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_master_requires_admin_check
      CHECK (is_master = false OR role::text = 'admin');
  END IF;
END $$;

-- 3. Overload has_role to accept text (avoids PG error 55P04 within same transaction)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _role
  );
$$;

-- 4. Function to check if a user is a master admin
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND is_master = true
  );
$$;

-- 5. Function to check if a user has CMS access (admin, editor, or content_manager)
CREATE OR REPLACE FUNCTION public.has_cms_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'editor', 'content_manager')
  );
$$;

-- 6. Trigger: Ensure a master admin cannot accidentally remove the last master account
-- Safe under concurrent transactions using an advisory transaction lock
CREATE OR REPLACE FUNCTION public.prevent_removing_last_master_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_count INT;
BEGIN
  -- If attempting to delete or demote/alter a master admin account
  IF (TG_OP = 'DELETE' AND OLD.is_master = true) OR
     (TG_OP = 'UPDATE' AND OLD.is_master = true AND (NEW.is_master = false OR NEW.role::text != 'admin')) THEN

    -- Serialize concurrent master modifications across transactions
    PERFORM pg_advisory_xact_lock(hashtext('user_roles_master_admin_protection'));

    -- Check remaining master count on DELETE
    IF TG_OP = 'DELETE' THEN
      SELECT COUNT(*) INTO v_master_count 
      FROM public.user_roles 
      WHERE is_master = true;

      IF v_master_count <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last master administrator. Designate another master admin before removing this account.';
      END IF;
    END IF;

    -- Check remaining master count on UPDATE (demotion)
    IF TG_OP = 'UPDATE' THEN
      SELECT COUNT(*) INTO v_master_count 
      FROM public.user_roles 
      WHERE is_master = true AND id != OLD.id;

      IF v_master_count < 1 THEN
        RAISE EXCEPTION 'Cannot demote the last master administrator. Designate another master admin before removing master status.';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_removing_last_master_admin ON public.user_roles;
CREATE TRIGGER trg_prevent_removing_last_master_admin
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_removing_last_master_admin();

-- 7. Hardened RLS policies on user_roles
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete non-master roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Anyone authenticated can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all user roles
CREATE POLICY "Admins can view user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only Master Admins can grant the 'admin' role or set is_master = true
-- Standard admins can only assign non-admin roles (editor, moderator, etc.)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND (
    (is_master = false AND role::text != 'admin')
    OR public.is_master_admin(auth.uid())
  )
);

-- Master roles can only be updated by master admins
-- Standard admins can only update non-admin roles to non-admin roles
CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    (is_master = false AND role::text != 'admin')
    OR public.is_master_admin(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND (
    (is_master = false AND role::text != 'admin')
    OR public.is_master_admin(auth.uid())
  )
);

-- Non-admin roles can be deleted by admins; admin and master roles can only be deleted by master admins
CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    (is_master = false AND role::text != 'admin')
    OR public.is_master_admin(auth.uid())
  )
);

-- 8. Content table policies: grant 'editor' permissions alongside 'admin'
-- Blog Posts (Editors can manage blog content)
DROP POLICY IF EXISTS "Admins can manage blog" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins manage blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and editors manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins and editors manage blog posts"
ON public.blog_posts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- Banners (Editors can manage banner content)
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
DROP POLICY IF EXISTS "Admins and editors manage banners" ON public.banners;
CREATE POLICY "Admins and editors manage banners"
ON public.banners FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- FAQs (Editors can manage FAQ content)
DROP POLICY IF EXISTS "Admins can manage faqs" ON public.faqs;
DROP POLICY IF EXISTS "Admins manage faqs" ON public.faqs;
DROP POLICY IF EXISTS "Admins and editors manage faqs" ON public.faqs;
CREATE POLICY "Admins and editors manage faqs"
ON public.faqs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- Testimonials (Editors can manage testimonial content)
DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins and editors manage testimonials" ON public.testimonials;
CREATE POLICY "Admins and editors manage testimonials"
ON public.testimonials FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- 9. Products: Restrict editors to updating approved content fields only.
-- Editors MUST NOT change prices, inventory (stock_quantity), rating metadata, activation state,
-- feature flags, primary key IDs, or timestamps, and cannot insert or delete products.
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
DROP POLICY IF EXISTS "Admins and editors manage products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins and editors can update products" ON public.products;

CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and editors can update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- Database-level strict allowlist protection trigger for products
-- Only approved content fields may be modified by editors:
-- (name, slug, short_description, description, ingredients, how_to_use, benefits, category_id, image_url, gallery_urls, badge)
CREATE OR REPLACE FUNCTION public.enforce_editor_product_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If caller is an editor and NOT an admin, enforce strict content-only allowlist
  IF public.has_role(auth.uid(), 'editor') AND NOT public.has_role(auth.uid(), 'admin') THEN
    -- Protect Primary Key
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Editors are not permitted to change product ID.';
    END IF;

    -- Protect Pricing
    IF NEW.price IS DISTINCT FROM OLD.price THEN
      RAISE EXCEPTION 'Editors are not permitted to change product price.';
    END IF;
    IF NEW.original_price IS DISTINCT FROM OLD.original_price THEN
      RAISE EXCEPTION 'Editors are not permitted to change product original_price.';
    END IF;

    -- Protect Inventory
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
      RAISE EXCEPTION 'Editors are not permitted to change product inventory (stock_quantity).';
    END IF;

    -- Protect Customer Rating & Review Metrics
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN
      RAISE EXCEPTION 'Editors are not permitted to modify product rating.';
    END IF;
    IF NEW.review_count IS DISTINCT FROM OLD.review_count THEN
      RAISE EXCEPTION 'Editors are not permitted to modify product review_count.';
    END IF;

    -- Protect Activation State & Store Feature Flags
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Editors are not permitted to change product activation state (is_active).';
    END IF;
    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION 'Editors are not permitted to change product featured status (is_featured).';
    END IF;

    -- Protect Audit Timestamps
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

DROP TRIGGER IF EXISTS trg_enforce_editor_product_restrictions ON public.products;
CREATE TRIGGER trg_enforce_editor_product_restrictions
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_editor_product_restrictions();
