
-- Admin policies for product_health_concerns
CREATE POLICY "Admins can manage product concerns"
ON public.product_health_concerns
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Public read access for product images
CREATE POLICY "Product images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

-- Admin write access for product images
CREATE POLICY "Admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admin policies for order_items (admins need to view all)
CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
