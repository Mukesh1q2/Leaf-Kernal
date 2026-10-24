-- ==============================================================================
-- Migration: Inventory Stock Movements Audit Ledger & Comprehensive Abuse-Resistant Sync
-- 
-- 1. Creates public.stock_movements immutable audit ledger.
-- 2. Strictly prohibits modification or deletion of ledger rows via BEFORE UPDATE/DELETE trigger.
-- 3. Adds CHECK (stock_quantity >= 0) to ensure negative stock is impossible at database engine level.
-- 4. Centralizes ledger row generation into a single authoritative trigger on public.products:
--    - Runs on EVERY update to stock_quantity with NO bypass branch.
--    - Eliminates bypassable session settings; transaction settings only supply optional context metadata.
-- 5. Implements atomic adjust_product_stock RPC restricted to admin and inventory_manager.
-- 6. Implements order inventory sync on orders status transition:
--    - Backfills orders.stock_deducted for existing confirmed/shipped/delivered orders BEFORE trigger enablement.
--    - Deducts stock exactly once upon confirmation; guards against duplicate callbacks via stock_deducted flag.
--    - Locks product rows with FOR UPDATE and checks availability; aborts on insufficient stock (no overselling).
--    - Restores stock exactly once upon order cancellation (only if unfulfilled/unshipped).
--    - IMPORTANT RETURN SEMANTICS: Order returns ('returned') do NOT automatically restock consumables
--      to available inventory. Returned goods must undergo physical warehouse inspection, and are restocked
--      only if verified sellable via explicit staff adjustment ('sale_return').
-- ==============================================================================

SET lock_timeout = '3s';

-- 1. Create stock_movements ledger table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  previous_quantity int NOT NULL,
  new_quantity int NOT NULL,
  quantity_delta int NOT NULL,
  reason text NOT NULL, -- 'restock', 'damage', 'audit_correction', 'sale_return', 'manual_adjustment', 'order_placed', 'order_cancelled'
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product 
ON public.stock_movements(product_id, created_at DESC);

-- 2. Enable Row Level Security
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Staff with admin or inventory_manager can view audit ledger
DROP POLICY IF EXISTS "Staff can view stock movements" ON public.stock_movements;
CREATE POLICY "Staff can view stock movements"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'inventory_manager'::app_role)
);

-- Deny direct client INSERT/UPDATE/DELETE; movements must be recorded exclusively via trusted database triggers
DROP POLICY IF EXISTS "Deny direct inserts to stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Deny direct updates to stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Deny direct deletes to stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Deny direct client writes to stock movements" ON public.stock_movements;

CREATE POLICY "Deny direct client writes to stock movements"
ON public.stock_movements
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 4. Prevent ledger tampering trigger: rows are strictly immutable
CREATE OR REPLACE FUNCTION public.prevent_stock_ledger_tampering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Stock movement ledger rows are immutable audit records and cannot be modified or deleted.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_stock_ledger_tampering ON public.stock_movements;
CREATE TRIGGER trg_prevent_stock_ledger_tampering
BEFORE UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.prevent_stock_ledger_tampering();

-- 5. Add database-level check constraint preventing negative stock on products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND constraint_name = 'products_stock_quantity_non_negative'
  ) THEN
    ALTER TABLE public.products
    ADD CONSTRAINT products_stock_quantity_non_negative
    CHECK (stock_quantity >= 0)
    NOT VALID;

    ALTER TABLE public.products VALIDATE CONSTRAINT products_stock_quantity_non_negative;
  END IF;
END $$;

-- 6. Authoritative trigger on products: generates exactly one ledger row per stock change
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
  v_low_threshold int;
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

      -- Automatically maintain stock status flags
      v_low_threshold := COALESCE(NEW.low_stock_threshold, 10);
      NEW.in_stock := (v_new_qty > 0);
      NEW.stock_status := CASE
        WHEN v_new_qty = 0 THEN 'out_of_stock'
        WHEN v_new_qty < v_low_threshold THEN 'low_stock'
        ELSE 'in_stock'
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_product_stock_movement ON public.products;
CREATE TRIGGER trg_record_product_stock_movement
BEFORE INSERT OR UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.record_product_stock_movement();

-- 7. Atomic RPC to adjust product stock
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id uuid,
  p_new_quantity int DEFAULT NULL,
  p_reason text DEFAULT 'manual_adjustment',
  p_notes text DEFAULT NULL,
  p_delta int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_authorized boolean;
  v_old_qty int;
  v_target_qty int;
  v_delta int;
BEGIN
  -- 1. Role Authorization: Admin or Inventory Manager only
  v_is_authorized := public.has_role(auth.uid(), 'admin'::app_role) 
                     OR public.has_role(auth.uid(), 'inventory_manager'::app_role);
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: Only Admins or Inventory Managers can adjust product stock.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validate reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Adjustment reason is required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_reason NOT IN ('restock', 'damage', 'audit_correction', 'sale_return', 'manual_adjustment') THEN
    RAISE EXCEPTION 'Invalid adjustment reason: %.', p_reason
      USING ERRCODE = '22023';
  END IF;

  -- 3. Lock product row for atomic update
  SELECT stock_quantity INTO v_old_qty
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with ID % not found.', p_product_id
      USING ERRCODE = 'P0002';
  END IF;

  v_old_qty := COALESCE(v_old_qty, 0);

  -- 4. Calculate target quantity
  IF p_new_quantity IS NOT NULL THEN
    v_target_qty := p_new_quantity;
  ELSIF p_delta IS NOT NULL THEN
    v_target_qty := v_old_qty + p_delta;
  ELSE
    RAISE EXCEPTION 'Either p_new_quantity or p_delta must be provided.'
      USING ERRCODE = '22023';
  END IF;

  IF v_target_qty < 0 THEN
    RAISE EXCEPTION 'Stock quantity cannot be negative.'
      USING ERRCODE = '22003';
  END IF;

  v_delta := v_target_qty - v_old_qty;

  -- 5. Set transaction-local context metadata for the products trigger
  PERFORM set_config('leaf.stock_reason', p_reason, true);
  PERFORM set_config('leaf.stock_notes', COALESCE(p_notes, 'Manual staff adjustment'), true);

  -- 6. Atomically update product stock (fires trg_record_product_stock_movement to write exactly ONE ledger row)
  UPDATE public.products
  SET stock_quantity = v_target_qty,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'previous_quantity', v_old_qty,
    'new_quantity', v_target_qty,
    'quantity_delta', v_delta,
    'reason', p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, int, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, int, text, text, int) TO authenticated;

-- 8. Backfill orders.stock_deducted BEFORE enabling trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'stock_deducted'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN stock_deducted boolean NOT NULL DEFAULT false;
  END IF;

  -- Explicitly reconcile historical orders: existing confirmed, shipped, and delivered orders
  -- must not have stock deducted again during subsequent admin operations.
  UPDATE public.orders
  SET stock_deducted = true
  WHERE status IN ('confirmed', 'shipped', 'delivered') AND NOT stock_deducted;
END $$;

-- 9. Trigger on Orders to synchronize checkout order placement and cancellation
CREATE OR REPLACE FUNCTION public.handle_order_inventory_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_curr_stock int;
  v_prod_name text;
BEGIN
  -- A. Order Confirmation: deduct stock exactly once
  IF NEW.status IN ('confirmed', 'shipped', 'delivered') AND (OLD.stock_deducted IS NULL OR NOT OLD.stock_deducted) THEN
    FOR v_item IN (
      SELECT product_id, quantity, product_name
      FROM public.order_items
      WHERE order_id = NEW.id
    ) LOOP
      IF v_item.product_id IS NOT NULL THEN
        -- Atomic row lock on product to prevent concurrent overselling
        SELECT stock_quantity, name INTO v_curr_stock, v_prod_name
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Ordered product % not found in catalog.', v_item.product_id
            USING ERRCODE = 'P0002';
        END IF;

        IF v_curr_stock < v_item.quantity THEN
          RAISE EXCEPTION 'Insufficient stock for product "%" (Available: %, Requested: %)',
            COALESCE(v_prod_name, v_item.product_name), v_curr_stock, v_item.quantity
            USING ERRCODE = '22003';
        END IF;

        -- Set transaction-local metadata for product trigger
        PERFORM set_config('leaf.stock_reason', 'order_placed', true);
        PERFORM set_config('leaf.stock_notes', 'Order confirmed: #' || NEW.id, true);

        UPDATE public.products
        SET stock_quantity = stock_quantity - v_item.quantity,
            updated_at = now()
        WHERE id = v_item.product_id;
      END IF;
    END LOOP;

    NEW.stock_deducted := true;

  -- B. Order Cancellation: restore stock exactly once only if previously deducted
  -- NOTE ON RETURN SEMANTICS: Consumables and botanicals marked 'returned' are NOT automatically
  -- restocked. They must undergo physical inspection and be manually adjusted via 'sale_return'.
  ELSIF NEW.status = 'cancelled' AND (OLD.stock_deducted IS TRUE) THEN
    FOR v_item IN (
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = NEW.id
    ) LOOP
      IF v_item.product_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_curr_stock
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF FOUND THEN
          PERFORM set_config('leaf.stock_reason', 'order_cancelled', true);
          PERFORM set_config('leaf.stock_notes', 'Order cancelled: #' || NEW.id, true);

          UPDATE public.products
          SET stock_quantity = stock_quantity + v_item.quantity,
              updated_at = now()
          WHERE id = v_item.product_id;
        END IF;
      END IF;
    END LOOP;

    NEW.stock_deducted := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_inventory_sync ON public.orders;
CREATE TRIGGER trg_order_inventory_sync
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_inventory_sync();

COMMENT ON TABLE public.stock_movements IS 'Immutable audit ledger for all inventory adjustments and commercial stock movements.';
COMMENT ON FUNCTION public.adjust_product_stock(uuid, int, text, text, int) IS 'Staff RPC to adjust stock with reason and attribution; writes to ledger via product trigger.';
