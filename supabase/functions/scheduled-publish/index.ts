import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();

  // Auto-publish scheduled blog posts
  const { data: posts, error: postErr } = await supabase
    .from("blog_posts")
    .update({ is_published: true, published_at: now })
    .lte("scheduled_at", now)
    .eq("is_published", false)
    .not("scheduled_at", "is", null)
    .select("id, title");

  // Auto-activate scheduled banners
  const { data: activatedBanners } = await supabase
    .from("banners")
    .update({ is_active: true })
    .lte("starts_at", now)
    .eq("is_active", false)
    .not("starts_at", "is", null)
    .select("id, title");

  // Auto-deactivate expired banners
  const { data: deactivatedBanners } = await supabase
    .from("banners")
    .update({ is_active: false })
    .lte("ends_at", now)
    .eq("is_active", true)
    .not("ends_at", "is", null)
    .select("id, title");

  return new Response(JSON.stringify({
    published_posts: posts?.length || 0,
    activated_banners: activatedBanners?.length || 0,
    deactivated_banners: deactivatedBanners?.length || 0,
  }), { headers: { "Content-Type": "application/json" } });
});
