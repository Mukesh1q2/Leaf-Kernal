import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Invalid token");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Admin access required");

    const { productId, productName, description } = await req.json();
    if (!productId || !productName) throw new Error("Missing product info");

    const prompt = `Professional product photography of "${productName}" - ${description || "a premium Indian superfood supplement"}. Clean white background, studio lighting, high-quality commercial product shot. The product should be displayed in premium packaging with natural botanical elements. Ultra high resolution, 1:1 aspect ratio.`;

    // Call AI gateway for image generation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error: ${errText}`);
    }

    const aiData = await aiResponse.json();
    
    // Extract image from response
    const content = aiData.choices?.[0]?.message?.content;
    let imageData: string | null = null;

    if (Array.isArray(content)) {
      const imagePart = content.find((p: any) => p.type === "image_url" || p.type === "image");
      if (imagePart) {
        imageData = imagePart.image_url?.url || imagePart.url;
      }
    }

    if (!imageData) {
      throw new Error("No image generated from AI response");
    }

    // Decode base64 if needed
    let imageBytes: Uint8Array;
    if (imageData.startsWith("data:")) {
      const base64 = imageData.split(",")[1];
      imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    } else {
      // Fetch URL
      const imgResp = await fetch(imageData);
      imageBytes = new Uint8Array(await imgResp.arrayBuffer());
    }

    // Upload to storage
    const fileName = `${productId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);

    // Update product
    await supabase.from("products").update({ image_url: urlData.publicUrl }).eq("id", productId);

    return new Response(JSON.stringify({ image_url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
