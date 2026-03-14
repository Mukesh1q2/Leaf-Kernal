
-- Fix: restrict bundle_items read to only items in active bundles
DROP POLICY IF EXISTS "Anyone can read bundle items" ON public.bundle_items;
CREATE POLICY "Anyone can read bundle items of active bundles" ON public.bundle_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.product_bundles WHERE id = bundle_id AND is_active = true)
);
