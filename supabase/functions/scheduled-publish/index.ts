import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Validate authorization
  // Supports either:
  // 1. Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (passes Supabase API gateway directly)
  // 2. x-cron-secret: <CRON_SECRET> (with standard Bearer token for gateway)
  // 3. Authorization: Bearer <CRON_SECRET> (when deployed with --no-verify-jwt)
  const authHeader = req.headers.get("Authorization") || "";
  const xCronSecret = req.headers.get("x-cron-secret");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const isAuthorized =
    (serviceRoleKey && token === serviceRoleKey) ||
    (cronSecret && xCronSecret === cronSecret) ||
    (cronSecret && token === cronSecret);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey!
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

  if (postErr) {
    console.error("Error auto-publishing blog posts:", postErr);
  }

  // Auto-activate scheduled banners
  const { data: activatedBanners, error: bannerActErr } = await supabase
    .from("banners")
    .update({ is_active: true })
    .lte("starts_at", now)
    .eq("is_active", false)
    .not("starts_at", "is", null)
    .select("id, title");

  if (bannerActErr) {
    console.error("Error activating scheduled banners:", bannerActErr);
  }

  // Auto-deactivate expired banners
  const { data: deactivatedBanners, error: bannerDeactErr } = await supabase
    .from("banners")
    .update({ is_active: false })
    .lte("ends_at", now)
    .eq("is_active", true)
    .not("ends_at", "is", null)
    .select("id, title");

  if (bannerDeactErr) {
    console.error("Error deactivating expired banners:", bannerDeactErr);
  }

  return new Response(JSON.stringify({
    published_posts: posts?.length || 0,
    activated_banners: activatedBanners?.length || 0,
    deactivated_banners: deactivatedBanners?.length || 0,
    errors: {
      postErr: postErr ? postErr.message : null,
      bannerActErr: bannerActErr ? bannerActErr.message : null,
      bannerDeactErr: bannerDeactErr ? bannerDeactErr.message : null,
    },
  }), { headers: { "Content-Type": "application/json" } });
});
