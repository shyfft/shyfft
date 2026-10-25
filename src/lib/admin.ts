// Admin-only data access (permissions + reports). Backend RLS/functions enforce every rule.
import { supabase } from "@/integrations/supabase/client";

export type AdminPerm = { userId: string; verify: boolean; deletePosts: boolean; viewReports: boolean };
export type Report = { id: string; reporterId: string; targetUserId: string | null; postId: string | null; reason: string; createdAt: number };

export async function listAdminPerms(): Promise<AdminPerm[]> {
  const { data, error } = await supabase.from("admin_permissions").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ userId: r.user_id, verify: r.can_verify, deletePosts: r.can_delete_posts, viewReports: r.can_view_reports }));
}

export async function saveAdminPerm(p: AdminPerm) {
  const { error } = await supabase.rpc("set_admin_permissions", {
    _target: p.userId, _verify: p.verify, _delete: p.deletePosts, _reports: p.viewReports,
  });
  if (error) throw error;
}

export async function listReports(): Promise<Report[]> {
  const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, reporterId: r.reporter_id, targetUserId: r.target_user_id, postId: r.post_id, reason: r.reason, createdAt: new Date(r.created_at).getTime() }));
}
