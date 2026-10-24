-- ==============================================================================
-- Migration: Add Secure, Audited remove_user_role RPC & Harden Activity Log RLS
-- 
-- 1. Strictly requires admin privileges to revoke roles.
-- 2. Requires Master Administrator authorization to revoke 'admin' roles.
-- 3. Protects Master Administrator accounts from deletion.
-- 4. Automatically records actor, target, role, and timestamp in admin_activity_log
--    within the exact same transaction.
-- 5. Hardens admin_activity_log RLS to prevent audit record spoofing.
-- ==============================================================================

-- 1. Secure RPC to revoke user roles with transactional audit logging
CREATE OR REPLACE FUNCTION public.remove_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_target_master boolean;
  v_caller_is_admin boolean;
  v_caller_is_master boolean;
  v_deleted_count int;
BEGIN
  -- 1. Check caller permissions
  v_caller_is_master := public.is_master_admin(auth.uid());
  v_caller_is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF NOT (v_caller_is_admin OR v_caller_is_master) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required to revoke roles.';
  END IF;

  -- 2. Check if target role exists and whether it is a protected master role
  SELECT is_master INTO v_is_target_master
  FROM public.user_roles
  WHERE user_id = p_user_id AND role::text = p_role;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Role assignment not found');
  END IF;

  IF v_is_target_master THEN
    RAISE EXCEPTION 'Cannot revoke protected Master Administrator role.';
  END IF;

  -- 3. If revoking an admin role, caller must be Master Admin
  IF p_role = 'admin' AND NOT v_caller_is_master THEN
    RAISE EXCEPTION 'Access denied: Only Master Administrator can revoke Admin roles.';
  END IF;

  -- 4. Delete the role assignment
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role::text = p_role;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 5. Atomically record in admin_activity_log within the same transaction
  INSERT INTO public.admin_activity_log (
    admin_id,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    auth.uid(),
    'role_revoked',
    'user_role',
    p_user_id::text,
    jsonb_build_object(
      'revoked_role', p_role,
      'revoked_by', auth.uid(),
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'user_id', p_user_id,
    'role', p_role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_user_role(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.remove_user_role(uuid, text) TO authenticated;

-- 2. Harden admin_activity_log RLS: prevent client-side audit record forgery
-- Only genuine admins can insert their own actions (admin_id = auth.uid())
DROP POLICY IF EXISTS "Admins can insert activity log" ON public.admin_activity_log;
CREATE POLICY "Admins can insert activity log"
ON public.admin_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND admin_id = auth.uid()
);

-- Ensure NO update or delete policies exist on admin_activity_log (append-only ledger)
DROP POLICY IF EXISTS "Admins can update activity log" ON public.admin_activity_log;
DROP POLICY IF EXISTS "Admins can delete activity log" ON public.admin_activity_log;
