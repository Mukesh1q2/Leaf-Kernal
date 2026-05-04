
-- 1. USER ACTIVITY (recommendations signal)
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  product_id uuid,
  activity_type text NOT NULL CHECK (activity_type IN ('view','add_to_cart','purchase','search','wishlist')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON public.user_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_product ON public.user_activity(product_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_session ON public.user_activity(session_id, created_at DESC);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert activity"
  ON public.user_activity FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Users read own activity"
  ON public.user_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all activity"
  ON public.user_activity FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. CHAT PERSISTENCE
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  title text DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON public.chat_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_session ON public.chat_conversations(session_id, updated_at DESC);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations"
  ON public.chat_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anon insert conversation by session"
  ON public.chat_conversations FOR INSERT TO public
  WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

CREATE POLICY "Anon read own session conversation"
  ON public.chat_conversations FOR SELECT TO public
  USING (user_id IS NULL);

CREATE POLICY "Admins read all conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read messages of own conversations"
  ON public.chat_messages FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.user_id = auth.uid() OR (c.user_id IS NULL))
  ));

CREATE POLICY "Users insert messages to own conversations"
  ON public.chat_messages FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.user_id = auth.uid() OR (c.user_id IS NULL))
  ));

CREATE POLICY "Admins read all messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_chat_conv_updated
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. RECOMMENDATION FUNCTIONS

-- Trending: top viewed/purchased products in last 14 days
CREATE OR REPLACE FUNCTION public.get_trending_products(p_limit int DEFAULT 8)
RETURNS SETOF public.products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.products p
  JOIN (
    SELECT product_id, COUNT(*) FILTER (WHERE activity_type='view') * 1
         + COUNT(*) FILTER (WHERE activity_type='add_to_cart') * 3
         + COUNT(*) FILTER (WHERE activity_type='purchase') * 5 AS score
    FROM public.user_activity
    WHERE created_at > now() - interval '14 days' AND product_id IS NOT NULL
    GROUP BY product_id
  ) s ON s.product_id = p.id
  WHERE p.is_active = true
  ORDER BY s.score DESC, p.rating DESC NULLS LAST
  LIMIT p_limit;
$$;

-- Recommended for you: based on a user's recently viewed categories + concerns
CREATE OR REPLACE FUNCTION public.get_recommended_products(p_user_id uuid, p_limit int DEFAULT 8)
RETURNS SETOF public.products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH recent AS (
    SELECT product_id FROM public.user_activity
    WHERE user_id = p_user_id AND product_id IS NOT NULL
      AND created_at > now() - interval '60 days'
    ORDER BY created_at DESC LIMIT 30
  ),
  cats AS (
    SELECT DISTINCT category_id FROM public.products WHERE id IN (SELECT product_id FROM recent)
  ),
  concerns AS (
    SELECT DISTINCT concern_id FROM public.product_health_concerns
    WHERE product_id IN (SELECT product_id FROM recent)
  )
  SELECT p.* FROM public.products p
  WHERE p.is_active = true
    AND p.id NOT IN (SELECT product_id FROM recent)
    AND (
      p.category_id IN (SELECT category_id FROM cats)
      OR EXISTS (
        SELECT 1 FROM public.product_health_concerns phc
        WHERE phc.product_id = p.id AND phc.concern_id IN (SELECT concern_id FROM concerns)
      )
    )
  ORDER BY p.rating DESC NULLS LAST, p.review_count DESC NULLS LAST
  LIMIT p_limit;
$$;

-- Frequently bought together: products co-purchased in same orders
CREATE OR REPLACE FUNCTION public.get_frequently_bought_together(p_product_id uuid, p_limit int DEFAULT 4)
RETURNS SETOF public.products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.products p
  JOIN (
    SELECT oi2.product_id, COUNT(*) AS freq
    FROM public.order_items oi1
    JOIN public.order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id <> oi2.product_id
    WHERE oi1.product_id = p_product_id
    GROUP BY oi2.product_id
    ORDER BY freq DESC
    LIMIT 20
  ) s ON s.product_id = p.id
  WHERE p.is_active = true
  ORDER BY s.freq DESC
  LIMIT p_limit;
$$;
