-- ==============================================================================
-- Migration: Preserve Financial Order History on Account Deletion & Prevent Hard Delete
-- 
-- 1. Modifies orders.user_id to ON DELETE SET NULL to prevent customer account
--    deletion from cascading and wiping financial orders.
-- 2. Modifies order_items.product_id to ON DELETE SET NULL to preserve immutable
--    line item historical snapshots (unit price, item name, quantity, subtotal).
-- 3. Adds stock_deducted boolean column to orders for idempotent inventory tracking.
-- 4. Strictly prohibits hard-deleting orders, order_items, and deliveries via
--    BEFORE DELETE triggers and ON DELETE RESTRICT constraints.
-- 5. Employs DDL lock safety: sets lock_timeout and uses NOT VALID + VALIDATE CONSTRAINT
--    to prevent ACCESS EXCLUSIVE lock queueing on concurrent storefront traffic.
-- 
-- STATUTORY RETENTION & PRIVACY REQUIREMENTS NOTE:
-- - Companies Act, 2013, Section 128(5): Mandates keeping books of account and related
--   vouchers for a period of not less than eight financial years immediately preceding
--   a financial year.
-- - Central Goods and Services Tax (CGST) Act, 2017, Section 36: Mandates retaining accounts
--   and records for 72 months from the due date of furnishing of the annual return for
--   the year pertaining to such accounts and records, and if subject to appeal/revision/
--   proceedings, for at least one year after final disposal.
-- 
-- CRITICAL POLICY DETERMINATION:
-- This migration ensures orders are structurally preserved when auth.users rows are removed.
-- It does NOT hardcode an arbitrary automated deletion timeline. The business must formally
-- confirm applicable retention rules, ongoing tax proceedings, and privacy redaction schedules
-- with its Chartered Accountant and legal counsel prior to implementing any automated purge.
-- ==============================================================================

-- Safeguard against lock queueing on concurrent transactions
SET lock_timeout = '3s';

-- 1. Allow orders.user_id to be nullable so orders persist if account is deleted
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add stock_deducted tracking column for idempotent inventory accounting
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

-- Idempotently initialize stock_deducted for existing historical orders
UPDATE public.orders
SET stock_deducted = true
WHERE status IN ('confirmed', 'shipped', 'delivered') AND NOT stock_deducted;

-- 3. Drop existing foreign key constraint from orders to auth.users if exists
DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'orders'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) LOOP
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(v_constraint);
  END LOOP;
END $$;

-- 4. Re-add foreign key on orders.user_id with ON DELETE SET NULL using safe validation
ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE SET NULL
NOT VALID;

ALTER TABLE public.orders VALIDATE CONSTRAINT orders_user_id_fkey;

-- 5. Allow order_items.product_id to be nullable with ON DELETE SET NULL
ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;

DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'order_items'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'product_id'
  ) LOOP
    EXECUTE 'ALTER TABLE public.order_items DROP CONSTRAINT ' || quote_ident(v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_product_id_fkey
FOREIGN KEY (product_id) REFERENCES public.products(id)
ON DELETE SET NULL
NOT VALID;

ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_product_id_fkey;

-- 6. Harden order_items -> orders foreign key to RESTRICT (not cascade)
DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'order_items'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'order_id'
  ) LOOP
    EXECUTE 'ALTER TABLE public.order_items DROP CONSTRAINT ' || quote_ident(v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_order_id_fkey
FOREIGN KEY (order_id) REFERENCES public.orders(id)
ON DELETE RESTRICT
NOT VALID;

ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_order_id_fkey;

-- 7. Strictly prohibit destructive deletion of orders, order items, and deliveries
CREATE OR REPLACE FUNCTION public.prevent_financial_record_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion of financial records is prohibited. Orders, line items, and deliveries are immutable transaction records. Cancel or archive the order instead.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_order_delete ON public.orders;
CREATE TRIGGER trg_prevent_order_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_record_deletion();

DROP TRIGGER IF EXISTS trg_prevent_order_item_delete ON public.order_items;
CREATE TRIGGER trg_prevent_order_item_delete
BEFORE DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_record_deletion();

DROP TRIGGER IF EXISTS trg_prevent_delivery_delete ON public.deliveries;
CREATE TRIGGER trg_prevent_delivery_delete
BEFORE DELETE ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_record_deletion();

COMMENT ON COLUMN public.orders.user_id IS 'Customer account reference; sets NULL upon user account deletion to preserve accounting ledger.';
COMMENT ON COLUMN public.orders.stock_deducted IS 'Idempotency tracking flag ensuring inventory is deducted exactly once on confirmation and restored exactly once on cancellation.';
COMMENT ON COLUMN public.order_items.product_id IS 'Catalog product reference; sets NULL upon product removal while keeping snapshot product_name and price.';
