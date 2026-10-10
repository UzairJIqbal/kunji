import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// Whether the admin pages should show their tools or a "not an admin" note.
// Display only: the answer comes from the admins policy (only an admin can see
// any admin row), and every write is still refused by its own policy whatever
// this says.
export async function viewerSeesAdminRows(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("admins")
    .select("clerk_user_id", { count: "exact", head: true });
  if (error) throw new Error(`Couldn't read the admins table: ${error.message}`);
  return (count ?? 0) > 0;
}
