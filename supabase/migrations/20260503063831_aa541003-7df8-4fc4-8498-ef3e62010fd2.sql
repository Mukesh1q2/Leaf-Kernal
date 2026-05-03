
-- NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- DELIVERIES TABLE
CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  tracking_id text,
  carrier text,
  status text NOT NULL DEFAULT 'placed',
  estimated_delivery date,
  notes text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliveries_order ON public.deliveries(order_id);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deliveries" ON public.deliveries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own delivery" ON public.deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = deliveries.order_id AND o.user_id = auth.uid()));

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: notify on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.user_id, 'order_status',
            'Order ' || NEW.status,
            'Your order #' || substr(NEW.id::text,1,8) || ' is now ' || NEW.status,
            '/account', jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- Trigger: notify on delivery status update + append to timeline
CREATE OR REPLACE FUNCTION public.notify_delivery_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.timeline := COALESCE(OLD.timeline, '[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object('status', NEW.status, 'at', now()));
    SELECT user_id INTO v_user_id FROM public.orders WHERE id = NEW.order_id;
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (v_user_id, 'delivery',
              'Delivery update: ' || NEW.status,
              CASE WHEN NEW.tracking_id IS NOT NULL
                   THEN 'Tracking #' || NEW.tracking_id || ' — ' || NEW.status
                   ELSE 'Status: ' || NEW.status END,
              '/account',
              jsonb_build_object('order_id', NEW.order_id, 'tracking_id', NEW.tracking_id));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_delivery_update
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_update();

-- Trigger: notify wishlist owners on price drop
CREATE OR REPLACE FUNCTION public.notify_price_drop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.price < OLD.price THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT w.user_id, 'price_drop',
           'Price drop: ' || NEW.name,
           'Now ₹' || NEW.price::text || ' (was ₹' || OLD.price::text || ')',
           '/product/' || NEW.slug,
           jsonb_build_object('product_id', NEW.id, 'old_price', OLD.price, 'new_price', NEW.price)
    FROM public.wishlist_items w WHERE w.product_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_price_drop
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_price_drop();
