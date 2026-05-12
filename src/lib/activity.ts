import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "lk_session_id";
function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export type ActivityType = "view" | "add_to_cart" | "purchase" | "search" | "wishlist" | "quiz_complete" | "reorder" | "subscribe";

export async function trackActivity(
  activity_type: ActivityType,
  product_id?: string | null,
  metadata: Record<string, any> = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("user_activity").insert({
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      product_id: product_id ?? null,
      activity_type,
      metadata,
    });
  } catch (e) {
    // non-blocking
    console.debug("trackActivity failed", e);
  }
}
