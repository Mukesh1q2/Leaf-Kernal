
-- Add is_master flag to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;

-- Mark existing admin role for mukesh1q2@gmail.com as master
UPDATE public.user_roles SET is_master = true WHERE user_id = '69fd5e32-eada-4b57-865e-32db0b8ceb76' AND role = 'admin';

-- Drop and recreate delete policy to prevent master admin removal
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Admins can view user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND is_master = false);

CREATE POLICY "Admins can delete non-master roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND is_master = false);

-- Keep the existing user self-view policy
-- Already exists: "Users can view own roles"
