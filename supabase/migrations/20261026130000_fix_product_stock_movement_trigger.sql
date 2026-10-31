-- ==============================================================================
-- Migration: Fix Product Stock Movement Trigger Sequence
-- 
-- Rationale:
--   The previous trigger 'trg_record_product_stock_movement' was declared as
--   BEFORE INSERT OR UPDATE on public.products. When inserting a new product,
--   inserting into public.stock_movements (which references public.products.id)
--   failed with a foreign key violation because the parent product row had not yet
--   been committed/inserted.
--
-- Solution:
--   Change the trigger to AFTER INSERT OR UPDATE OF stock_quantity ON public.products,
--   ensuring the parent product row exists before public.stock_movements references it.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_product_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_qty int;
  v_new_qty int;
  v_delta int;
  v_reason text;
  v_notes text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_quantity IS NOT NULL AND NEW.stock_quantity > 0 THEN
      INSERT INTO public.stock_movements (
        product_id,
        previous_quantity,
        new_quantity,
        quantity_delta,
        reason,
        notes,
        created_by
      ) VALUES (
        NEW.id,
        0,
        NEW.stock_quantity,
        NEW.stock_quantity,
        'restock',
        'Initial product catalog creation',
        auth.uid()
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
      v_old_qty := COALESCE(OLD.stock_quantity, 0);
      v_new_qty := COALESCE(NEW.stock_quantity, 0);
      v_delta := v_new_qty - v_old_qty;

      -- Read optional transaction-local context metadata
      v_reason := NULLIF(current_setting('leaf.stock_reason', true), '');
      v_notes := NULLIF(current_setting('leaf.stock_notes', true), '');

      -- Immediately clear context settings so they cannot leak
      PERFORM set_config('leaf.stock_reason', '', true);
      PERFORM set_config('leaf.stock_notes', '', true);

      -- Fallback to default reasons if not explicitly supplied
      IF v_reason IS NULL THEN
        IF v_delta > 0 THEN
          v_reason := 'restock';
          v_notes := COALESCE(v_notes, 'Stock quantity increased via catalog update');
        ELSE
          v_reason := 'manual_adjustment';
          v_notes := COALESCE(v_notes, 'Stock quantity adjusted via catalog update');
        END IF;
      END IF;

      -- Insert the single authoritative ledger row
      INSERT INTO public.stock_movements (
        product_id,
        previous_quantity,
        new_quantity,
        quantity_delta,
        reason,
        notes,
        created_by
      ) VALUES (
        NEW.id,
        v_old_qty,
        v_new_qty,
        v_delta,
        v_reason,
        v_notes,
        auth.uid()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_product_stock_movement ON public.products;
CREATE TRIGGER trg_record_product_stock_movement
AFTER INSERT OR UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.record_product_stock_movement();
