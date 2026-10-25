CREATE TABLE public.admin_permissions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_verify boolean NOT NULL DEFAULT false,
  can_delete_posts boolean NOT NULL DEFAULT false,
  can_view_reports boolean NOT NULL DEFAULT false,
  granted_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or super admin reads" ON public.admin_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_admin_perm(_user uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user, 'admin') OR EXISTS (
    SELECT 1 FROM public.admin_permissions p WHERE p.user_id = _user AND
      CASE _perm WHEN 'verify' THEN p.can_verify WHEN 'delete_posts' THEN p.can_delete_posts
        WHEN 'view_reports' THEN p.can_view_reports ELSE false END)
$$;

CREATE OR REPLACE FUNCTION public.set_admin_permissions(_target uuid, _verify boolean, _delete boolean, _reports boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the super admin can change permissions' USING errcode = '42501';
  END IF;
  IF NOT (_verify OR _delete OR _reports) THEN
    DELETE FROM public.admin_permissions WHERE user_id = _target;
  ELSE
    INSERT INTO public.admin_permissions(user_id, can_verify, can_delete_posts, can_view_reports, granted_by, updated_at)
    VALUES (_target, _verify, _delete, _reports, auth.uid(), now())
    ON CONFLICT (user_id) DO UPDATE SET can_verify = EXCLUDED.can_verify, can_delete_posts = EXCLUDED.can_delete_posts,
      can_view_reports = EXCLUDED.can_view_reports, granted_by = EXCLUDED.granted_by, updated_at = now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_user_verified(_target uuid, _verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'verify') THEN
    RAISE EXCEPTION 'You do not have permission to change verification' USING errcode = '42501';
  END IF;
  UPDATE public.profiles SET verified = _verified WHERE id = _target;
END $$;

CREATE POLICY "moderators delete posts" ON public.posts FOR DELETE TO authenticated
  USING (public.has_admin_perm(auth.uid(), 'delete_posts'));
CREATE POLICY "moderators read reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_admin_perm(auth.uid(), 'view_reports'));
GRANT SELECT ON public.reports TO authenticated;