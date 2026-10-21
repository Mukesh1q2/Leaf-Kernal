-- Trigger to automatically recompute products.rating and products.review_count when a review is approved, modified, or deleted

CREATE OR REPLACE FUNCTION public.recompute_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_avg_rating NUMERIC(3,2);
  v_count INT;
BEGIN
  -- Determine product_id from either NEW or OLD row
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  -- Recompute average and count of approved reviews
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0),
    COUNT(*)
  INTO 
    v_avg_rating,
    v_count
  FROM public.reviews
  WHERE product_id = v_product_id AND is_approved = true;

  -- Update product row
  UPDATE public.products
  SET 
    rating = v_avg_rating,
    review_count = v_count,
    updated_at = now()
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_product_rating ON public.reviews;
CREATE TRIGGER trg_recompute_product_rating
  AFTER INSERT OR UPDATE OF rating, is_approved OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_product_rating();
