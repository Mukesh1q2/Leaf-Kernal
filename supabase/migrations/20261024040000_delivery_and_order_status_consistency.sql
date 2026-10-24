-- ==============================================================================
-- Migration: Harmonize Order and Delivery Status Consistency
-- 
-- 1. Defines single authoritative synchronization between commercial order status
--    ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') and fulfillment
--    transit status ('placed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'returned').
-- 2. Prevents contradictory transitions: cancelled orders cannot be shipped;
--    shipped or delivered orders cannot be marked cancelled.
-- 3. Enforces foreign key constraint on deliveries.order_id -> orders.id (ON DELETE RESTRICT).
-- 4. Idempotently backfills delivery rows for all existing orders.
-- 5. Automatically generates a delivery row upon new order creation.
-- 6. Employs DDL lock safety (lock_timeout and non-blocking constraint validation).
-- ==============================================================================

SET lock_timeout = '3s';

-- 1. Add Foreign Key constraint on deliveries.order_id if not present
DO $$
DECLARE
  v_constraint text;
BEGIN
  -- Drop existing cascade constraint if present to harden to RESTRICT
  FOR v_constraint IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'deliveries'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'order_id'
  ) LOOP
    EXECUTE 'ALTER TABLE public.deliveries DROP CONSTRAINT ' || quote_ident(v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.deliveries
ADD CONSTRAINT deliveries_order_id_fkey
FOREIGN KEY (order_id) REFERENCES public.orders(id)
ON DELETE RESTRICT
NOT VALID;

ALTER TABLE public.deliveries VALIDATE CONSTRAINT deliveries_order_id_fkey;

-- 2. Function to prevent cancelling already shipped or delivered orders
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing to cancelled if already shipped or delivered
  IF NEW.status = 'cancelled' AND OLD.status IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION 'Cannot cancel an order that is already %.', OLD.status
      USING ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_status_transition ON public.orders;
CREATE TRIGGER trg_validate_order_status_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_status_transition();

-- 3. Function to synchronize delivery updates with order status & block shipping cancelled orders
CREATE OR REPLACE FUNCTION public.sync_delivery_to_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
BEGIN
  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = NEW.order_id;

  -- Prevent shipping or delivering an order marked cancelled
  IF v_order_status = 'cancelled' AND NEW.status IN ('shipped', 'out_for_delivery', 'delivered') THEN
    RAISE EXCEPTION 'Cannot update delivery status to % for an order that is cancelled.', NEW.status
      USING ERRCODE = '22000';
  END IF;

  -- Synchronize commercial order status when logistics moves forward
  IF NEW.status IN ('shipped', 'out_for_delivery') AND v_order_status IN ('pending', 'confirmed', 'placed') THEN
    UPDATE public.orders
    SET status = 'shipped', updated_at = now()
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'delivered' AND v_order_status != 'delivered' THEN
    UPDATE public.orders
    SET status = 'delivered', updated_at = now()
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_delivery_to_order_status ON public.deliveries;
CREATE TRIGGER trg_sync_delivery_to_order_status
BEFORE INSERT OR UPDATE OF status ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_to_order_status();

-- 4. Function to automatically initialize delivery row upon order creation
CREATE OR REPLACE FUNCTION public.ensure_order_delivery_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deliveries (
    order_id,
    status,
    carrier,
    tracking_id,
    timeline
  ) VALUES (
    NEW.id,
    'placed',
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'status', 'placed',
        'timestamp', now(),
        'message', 'Order placed and delivery record initialized.'
      )
    )
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_order_delivery_record ON public.orders;
CREATE TRIGGER trg_ensure_order_delivery_record
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_delivery_record();

-- 5. Idempotent backfill: ensure all existing orders have a matching delivery record
INSERT INTO public.deliveries (order_id, status, carrier, tracking_id, timeline)
SELECT 
  o.id,
  CASE 
    WHEN o.status = 'delivered' THEN 'delivered'
    WHEN o.status = 'shipped' THEN 'shipped'
    ELSE 'placed'
  END,
  NULL,
  NULL,
  jsonb_build_array(
    jsonb_build_object(
      'status', 'placed',
      'timestamp', o.created_at,
      'message', 'Order placed'
    )
  )
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.deliveries d WHERE d.order_id = o.id
)
ON CONFLICT (order_id) DO NOTHING;
