import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, SlidersHorizontal, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCmsAuth } from "@/components/admin/AdminLayout";
import { Link } from "react-router-dom";
import { clearStoreSettingsCache } from "@/hooks/useStoreSettings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminSettings = () => {
  const { isMaster } = useCmsAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("site_settings").select("key, value");
      if (error) {
        toast({ title: "Failed to load settings", description: error.message, variant: "destructive" });
      } else {
        const map: Record<string, string> = {};
        (data || []).forEach(row => { map[row.key] = row.value || ""; });
        setSettings(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveAll = async () => {
    // Basic field validation
    if (settings.contact_email && !EMAIL_RE.test(settings.contact_email.trim())) {
      toast({ title: "Invalid contact email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (settings.free_shipping_threshold) {
      const thresh = Number(settings.free_shipping_threshold);
      if (isNaN(thresh) || thresh < 0) {
        toast({ title: "Invalid free shipping threshold", description: "Must be a non-negative number.", variant: "destructive" });
        return;
      }
    }
    if (settings.cod_fee) {
      const fee = Number(settings.cod_fee);
      if (isNaN(fee) || fee < 0) {
        toast({ title: "Invalid COD fee", description: "Must be a non-negative number.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const promises = Object.entries(settings).map(([key, value]) =>
      supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    );

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);

    setSaving(false);
    if (errors.length > 0) {
      toast({
        title: "Failed to save some settings",
        description: errors[0].error?.message || "Database write error",
        variant: "destructive",
      });
      return;
    }

    clearStoreSettingsCache();
    toast({ title: "Settings saved successfully!" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure store information, shipping thresholds, homepage copy, and social profiles</p>
        </div>
        <div className="flex items-center gap-2">
          {isMaster && (
            <Button variant="outline" asChild>
              <Link to="/admin/settings/features">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Feature Controls
              </Link>
            </Button>
          )}
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save All</>}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="homepage">Homepage &amp; Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="shipping">Shipping &amp; Payments</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Store Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Store Name</Label><Input value={settings.store_name || ""} onChange={(e) => update("store_name", e.target.value)} /></div>
              <div><Label>Tagline</Label><Input value={settings.store_tagline || ""} onChange={(e) => update("store_tagline", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Contact Email</Label><Input value={settings.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} /></div>
                <div><Label>Support Phone</Label><Input value={settings.support_phone || ""} onChange={(e) => update("support_phone", e.target.value)} /></div>
              </div>
              <div><Label>WhatsApp Number (e.g. 918796745590)</Label><Input value={settings.whatsapp_number || ""} onChange={(e) => update("whatsapp_number", e.target.value)} /></div>
              <div><Label>Registered Business Address</Label><Textarea value={settings.business_address || ""} onChange={(e) => update("business_address", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>FSSAI License Number</Label><Input value={settings.fssai_number || ""} onChange={(e) => update("fssai_number", e.target.value)} /></div>
                <div><Label>GSTIN</Label><Input value={settings.gstin || ""} onChange={(e) => update("gstin", e.target.value)} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={settings.maintenance_mode === "true"} onCheckedChange={(v) => update("maintenance_mode", v ? "true" : "false")} />
                  Maintenance Mode
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homepage" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Homepage Hero &amp; Brand Statements</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Default Hero Headline</Label><Input value={settings.hero_headline || ""} onChange={(e) => update("hero_headline", e.target.value)} placeholder="Plant-powered superfoods for modern life" /></div>
              <div><Label>Default Hero Subtitle</Label><Textarea value={settings.hero_subtitle || ""} onChange={(e) => update("hero_subtitle", e.target.value)} rows={2} placeholder="Rooted in ancient Ayurvedic wisdom..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Hero CTA Button Text</Label><Input value={settings.hero_cta_text || ""} onChange={(e) => update("hero_cta_text", e.target.value)} placeholder="Shop Superfoods" /></div>
                <div><Label>Hero CTA Button Link</Label><Input value={settings.hero_cta_link || ""} onChange={(e) => update("hero_cta_link", e.target.value)} placeholder="/shop" /></div>
              </div>
              <div><Label>Quality Commitment Motto</Label><Textarea value={settings.quality_statement || ""} onChange={(e) => update("quality_statement", e.target.value)} rows={2} placeholder="Pure green goodness and authentic Ayurvedic superfoods..." /></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><Label>Stat 1 Value</Label><Input value={settings.stat_plant_based || ""} onChange={(e) => update("stat_plant_based", e.target.value)} placeholder="100%" /></div>
                <div><Label>Stat 2 Value</Label><Input value={settings.stat_heritage || ""} onChange={(e) => update("stat_heritage", e.target.value)} placeholder="Pure" /></div>
                <div><Label>Stat 3 Value</Label><Input value={settings.stat_quality || ""} onChange={(e) => update("stat_quality", e.target.value)} placeholder="Lab-Tested" /></div>
                <div><Label>Stat 4 Value</Label><Input value={settings.stat_delivery || ""} onChange={(e) => update("stat_delivery", e.target.value)} placeholder="Pan-India" /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">SEO Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Title Template</Label><Input value={settings.seo_title_template || ""} onChange={(e) => update("seo_title_template", e.target.value)} placeholder="{page} | Leaf &amp; Kernel" /></div>
              <div><Label>Default Meta Description</Label><Textarea value={settings.seo_default_description || ""} onChange={(e) => update("seo_default_description", e.target.value)} rows={2} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Shipping &amp; Payment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Free Shipping Threshold (₹)</Label><Input type="number" value={settings.free_shipping_threshold || ""} onChange={(e) => update("free_shipping_threshold", e.target.value)} /></div>
              <div className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Storefront Announcement Bar</p>
                  <p className="text-xs text-muted-foreground">Manage the top promotional message, linked coupons, and schedule.</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/announcements">Manage Bar</Link>
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={settings.cod_enabled === "true"} onCheckedChange={(v) => update("cod_enabled", v ? "true" : "false")} />
                  Cash on Delivery
                </label>
              </div>
              <div><Label>COD Extra Fee (₹)</Label><Input type="number" value={settings.cod_fee || ""} onChange={(e) => update("cod_fee", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Social Media Links</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Instagram URL</Label><Input value={settings.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." /></div>
              <div><Label>Facebook URL</Label><Input value={settings.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." /></div>
              <div><Label>YouTube URL</Label><Input value={settings.youtube_url || ""} onChange={(e) => update("youtube_url", e.target.value)} placeholder="https://youtube.com/..." /></div>
              <div><Label>Twitter / X URL</Label><Input value={settings.twitter_url || ""} onChange={(e) => update("twitter_url", e.target.value)} placeholder="https://x.com/..." /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
