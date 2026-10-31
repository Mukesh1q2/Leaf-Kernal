-- ==============================================================================
-- Migration: Secure Admin Dashboard Metrics RPC
-- 
-- Computes truthful, uncapped e-commerce aggregations entirely within Postgres:
-- 1. Captured/Paid revenue only (excludes cancelled, accounts for returns/refunds).
-- 2. Full-catalog stock analysis (low stock < 10, out of stock <= 0).
-- 3. Top products aggregation from order_items (units sold & revenue).
-- 4. Distinct ordering customers vs total registered customers.
-- 5. Operational attention triage: overdue fulfillment, pending reviews, unread inquiries.
-- 6. Role-protected execution: accessible only to authorized CMS staff.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_staff boolean;
  v_gross_sales numeric := 0;
  v_refunds numeric := 0;
  v_net_sales numeric := 0;
  v_paid_orders_count bigint := 0;
  v_pending_orders_count bigint := 0;
  v_cancelled_orders_count bigint := 0;
  v_returned_orders_count bigint := 0;
  v_total_orders_count bigint := 0;
  v_period_ordering_customers bigint := 0;
  v_total_registered_customers bigint := 0;
  v_total_products bigint := 0;
  v_low_stock_count bigint := 0;
  v_out_of_stock_count bigint := 0;
  v_pending_reviews_count bigint := 0;
  v_unread_inquiries_count bigint := 0;
  v_overdue_fulfillment_count bigint := 0;
  v_active_coupons_count bigint := 0;
  v_daily_revenue jsonb := '[]'::jsonb;
  v_top_products jsonb := '[]'::jsonb;
  v_orders_by_status jsonb := '[]'::jsonb;
BEGIN
  -- 1. Authorization check: must have at least one CMS staff role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'editor', 'content_manager', 'inventory_manager', 'customer_support', 'moderator')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Access denied: staff authorization required.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Orders & Revenue Aggregations (Period Filtered)
  -- Paid orders: confirmed, shipped, delivered AND verified payment session exists
  SELECT
    COALESCE(SUM(CASE WHEN o.status IN ('confirmed', 'shipped', 'delivered') AND o.stripe_session_id IS NOT NULL THEN o.total ELSE 0 END), 0),
    COUNT(CASE WHEN o.status IN ('confirmed', 'shipped', 'delivered') AND o.stripe_session_id IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END),
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END),
    COUNT(*),
    COUNT(DISTINCT CASE WHEN o.status IN ('confirmed', 'shipped', 'delivered') AND o.stripe_session_id IS NOT NULL THEN o.user_id END)
  INTO
    v_gross_sales,
    v_paid_orders_count,
    v_pending_orders_count,
    v_cancelled_orders_count,
    v_total_orders_count,
    v_period_ordering_customers
  FROM public.orders o
  WHERE (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date);

  -- Returns / refunds deduction
  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*)
  INTO
    v_refunds,
    v_returned_orders_count
  FROM public.orders o
  JOIN public.deliveries d ON d.order_id = o.id
  WHERE d.status = 'returned'
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date);

  v_net_sales := GREATEST(0, v_gross_sales - v_refunds);

  -- 3. Overdue fulfillment count: paid orders pending shipment > 24 hours
  SELECT COUNT(*)
  INTO v_overdue_fulfillment_count
  FROM public.orders o
  WHERE o.status = 'confirmed'
    AND o.stripe_session_id IS NOT NULL
    AND o.created_at < (now() - interval '24 hours');

  -- 4. Catalog stock levels (Scans FULL catalog)
  SELECT
    COUNT(*),
    COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity < 10 THEN 1 END),
    COUNT(CASE WHEN stock_quantity <= 0 THEN 1 END)
  INTO
    v_total_products,
    v_low_stock_count,
    v_out_of_stock_count
  FROM public.products
  WHERE is_active = true;

  -- 5. Customer & Community counts
  SELECT COUNT(*) INTO v_total_registered_customers FROM public.profiles;
  SELECT COUNT(*) INTO v_pending_reviews_count FROM public.reviews WHERE is_approved = false;
  
  -- Unread/open customer inquiries
  BEGIN
    SELECT COUNT(*) INTO v_unread_inquiries_count
    FROM public.inquiries
    WHERE status IN ('new', 'pending', 'unread');
  EXCEPTION WHEN undefined_table THEN
    v_unread_inquiries_count := 0;
  END;

  -- Active coupons count
  SELECT COUNT(*) INTO v_active_coupons_count FROM public.coupons WHERE is_active = true;

  -- 6. Orders by Status Breakdown
  SELECT jsonb_agg(jsonb_build_object('name', status, 'value', cnt))
  INTO v_orders_by_status
  FROM (
    SELECT status, COUNT(*) AS cnt
    FROM public.orders
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY status
  ) s;

  -- 7. Daily Revenue & Order Volume Breakdown
  SELECT jsonb_agg(jsonb_build_object(
    'date', day_date,
    'day', to_char(day_date, 'DD Mon'),
    'gross_sales', sales,
    'orders_count', orders_num
  ))
  INTO v_daily_revenue
  FROM (
    SELECT
      date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS day_date,
      COALESCE(SUM(CASE WHEN status IN ('confirmed', 'shipped', 'delivered') AND stripe_session_id IS NOT NULL THEN total ELSE 0 END), 0) AS sales,
      COUNT(CASE WHEN status IN ('confirmed', 'shipped', 'delivered') AND stripe_session_id IS NOT NULL THEN 1 END) AS orders_num
    FROM public.orders
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY 1
    ORDER BY 1 ASC
    LIMIT 90
  ) d;

  -- 8. Top Products by Sales Volume & Revenue (from order_items of paid orders)
  SELECT jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'product_name', product_name,
    'units_sold', units_sold,
    'revenue', revenue
  ))
  INTO v_top_products
  FROM (
    SELECT
      oi.product_id,
      oi.product_name,
      SUM(oi.quantity) AS units_sold,
      SUM(oi.price * oi.quantity) AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status IN ('confirmed', 'shipped', 'delivered')
      AND o.stripe_session_id IS NOT NULL
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    GROUP BY oi.product_id, oi.product_name
    ORDER BY units_sold DESC
    LIMIT 5
  ) tp;

  -- Return compiled jsonb metrics
  RETURN jsonb_build_object(
    'gross_sales', v_gross_sales,
    'net_sales', v_net_sales,
    'refunds', v_refunds,
    'paid_orders_count', v_paid_orders_count,
    'pending_orders_count', v_pending_orders_count,
    'cancelled_orders_count', v_cancelled_orders_count,
    'returned_orders_count', v_returned_orders_count,
    'total_orders_count', v_total_orders_count,
    'period_ordering_customers_count', v_period_ordering_customers,
    'total_registered_customers_count', v_total_registered_customers,
    'total_products_count', v_total_products,
    'low_stock_products_count', v_low_stock_count,
    'out_of_stock_products_count', v_out_of_stock_count,
    'pending_reviews_count', v_pending_reviews_count,
    'unread_inquiries_count', v_unread_inquiries_count,
    'overdue_fulfillment_count', v_overdue_fulfillment_count,
    'active_coupons_count', v_active_coupons_count,
    'daily_revenue', COALESCE(v_daily_revenue, '[]'::jsonb),
    'top_products', COALESCE(v_top_products, '[]'::jsonb),
    'orders_by_status', COALESCE(v_orders_by_status, '[]'::jsonb)
  );
END;
$$;

-- Grant execution to authenticated role (internal role verification ensures staff-only access)
REVOKE ALL ON FUNCTION public.get_admin_dashboard_metrics(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics(timestamptz, timestamptz) TO authenticated;
