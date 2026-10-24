-- ==============================================================================
-- Migration: Secure, Column-Restricted Customer Support Profile Access
-- 
-- 1. Eliminates broad column exposure for Customer Support on profiles.
--    RLS on profiles is restricted to admin and self (user_id = auth.uid()).
-- 2. Implements a secure SECURITY DEFINER RPC (get_customer_support_profiles) with
--    fixed search_path = public, pg_temp and explicit role authorization checks.
-- 3. Projects ONLY the four approved customer identity fields:
--    (user_id, full_name, phone, created_at).
-- 4. Exposes a companion view (customer_support_profiles) delegating to the RPC.
-- 5. Ensures Customer Support CANNOT access private addresses, credentials,
--    or internal metadata columns.
-- ==============================================================================

-- 1. Preserve strict RLS on the underlying public.profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view customer profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = user_id
);

-- 2. Secure RPC for direct typed invocation by Customer Support workflows
CREATE OR REPLACE FUNCTION public.get_customer_support_profiles()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict authorization check: must be admin or customer_support
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'customer_support'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: Customer Support or Admin role required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.phone,
    p.created_at
  FROM public.profiles p;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_support_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_support_profiles() TO authenticated;

-- 3. Create restricted view for Customer Support that delegates directly to the secure RPC
CREATE OR REPLACE VIEW public.customer_support_profiles
WITH (security_barrier = true)
AS
SELECT
  user_id,
  full_name,
  phone,
  created_at
FROM public.get_customer_support_profiles();

REVOKE ALL ON public.customer_support_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.customer_support_profiles TO authenticated;

COMMENT ON FUNCTION public.get_customer_support_profiles() IS 'Restricted RPC returning only non-sensitive identity fields to Customer Support staff.';
COMMENT ON VIEW public.customer_support_profiles IS 'Restricted view for Customer Support staff delegating to get_customer_support_profiles().';
