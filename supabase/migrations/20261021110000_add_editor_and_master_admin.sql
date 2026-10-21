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

-- 2. Ensure is_master column exists on user_roles
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;

-- 3. Function to check if a user is a master admin
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

-- 4. Function to check if a user has CMS access (admin or editor)
CREATE OR REPLACE FUNCTION public.has_cms_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::app_role, 'editor'::app_role, 'content_manager'::app_role)
  );
$$;

-- 5. Hardened RLS policies on user_roles
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete non-master roles" ON public.user_roles;
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
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only Master Admins can grant the 'admin' role or set is_master = true
-- Standard admins can only assign non-admin roles (editor, moderator, etc.)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    -- If setting is_master or admin, caller must be a master admin
    (is_master = false AND role != 'admin'::app_role)
    OR is_master_admin(auth.uid())
  )
);

-- Master roles cannot be updated by anyone other than master admin
CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (is_master = false OR is_master_admin(auth.uid()))
);

-- Master roles cannot be deleted; non-master roles can be deleted by admins
CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (is_master = false OR is_master_admin(auth.uid()))
);

-- 6. Content table policies: grant 'editor' permissions alongside 'admin'
-- Blog Posts
DROP POLICY IF EXISTS "Admins manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins and editors manage blog posts"
ON public.blog_posts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Banners
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins and editors manage banners"
ON public.banners FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- FAQs
DROP POLICY IF EXISTS "Admins manage faqs" ON public.faqs;
CREATE POLICY "Admins and editors manage faqs"
ON public.faqs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Testimonials
DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
CREATE POLICY "Admins and editors manage testimonials"
ON public.testimonials FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Products (Content editing)
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins and editors manage products"
ON public.products FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
