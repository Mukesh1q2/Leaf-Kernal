-- ==============================================================================
-- Migration: Add remove_user_role RPC for secure role revoking
-- Allows admins to revoke staff roles and master admins to revoke admin roles.
-- Protects master roles and guarantees last master administrator cannot be removed.
-- ==============================================================================

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
  v_deleted_count int;
BEGIN
  -- 1. Check if caller is admin or master admin
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required to revoke roles.';
  END IF;

  -- 2. Check if target role exists and is master
  SELECT is_master INTO v_is_target_master
  FROM public.user_roles
  WHERE user_id = p_user_id AND role::text = p_role;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Role assignment not found');
  END IF;

  IF v_is_target_master THEN
    RAISE EXCEPTION 'Cannot revoke protected Master Administrator role.';
  END IF;

  -- 3. If revoking an admin role, caller must be master admin
  IF p_role = 'admin' AND NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Only Master Administrator can revoke Admin roles.';
  END IF;

  -- 4. Delete the role
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role::text = p_role;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

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
