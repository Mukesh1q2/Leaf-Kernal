-- ==============================================================================
-- Migration: Storefront Announcement Bars Management
-- Creates:
--  1. public.announcements table with RLS and constraints
--  2. Safe public policies for active published announcements
--  3. Staff management policies for admin, editor, content_manager
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  priority integer NOT NULL DEFAULT 0,
  free_shipping_threshold numeric NOT NULL DEFAULT 999,
  announcement_copy text NOT NULL DEFAULT 'Free shipping on orders above ₹{threshold} 🌿 Pure, Plant-Powered Ayurvedic Superfoods',
  coupon_link_mode text NOT NULL DEFAULT 'automatic' CHECK (coupon_link_mode IN ('automatic', 'manual', 'none')),
  selected_coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_template text NOT NULL DEFAULT 'Use code {code} for {discount} off',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint for schedule start / end validity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_schedule_check'
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_schedule_check
      CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Staff management policy (admin, editor, content_manager)
DROP POLICY IF EXISTS "Staff can manage announcements" ON public.announcements;
CREATE POLICY "Staff can manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'content_manager')
);

-- Public SELECT policy: only enabled, published, and currently scheduled announcements
DROP POLICY IF EXISTS "Public can view active published announcements" ON public.announcements;
CREATE POLICY "Public can view active published announcements"
ON public.announcements
FOR SELECT
TO anon, authenticated
USING (
  is_enabled = true
  AND status = 'published'
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
);

-- Table privileges
GRANT ALL ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
