import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCmsAuth } from "@/components/admin/AdminLayout";
import { Link } from "react-router-dom";

const AdminSettings = () => {
  const { isMaster } = useCmsAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach(row => { map[row.key] = row.value || ""; });
      setSettings(map);
      setLoading(false);
    };
    load();
  }, []);

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveAll = async () => {
    setSaving(true);
    const promises = Object.entries(settings).map(([key, value]) =>
      supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    );
    await Promise.all(promises);
    toast({ title: "Settings saved!" });
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Loading settings...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure store information, shipping thresholds, and social profiles</p>
        </div>
        <div className="flex items-center gap-2">
          {isMaster && (
            <Button variant="outline" asChild>
              <Link to="/admin/settings/features">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Feature Controls
              </Link>
            </Button>
          )}
          <Button onClick={saveAll} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save All"}</Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="shipping">Shipping & Payments</TabsTrigger>
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
              <div><Label>WhatsApp Number</Label><Input value={settings.whatsapp_number || ""} onChange={(e) => update("whatsapp_number", e.target.value)} /></div>
              <div><Label>Business Address</Label><Input value={settings.business_address || ""} onChange={(e) => update("business_address", e.target.value)} /></div>
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

        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">SEO Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Title Template</Label><Input value={settings.seo_title_template || ""} onChange={(e) => update("seo_title_template", e.target.value)} placeholder="{page} | Store Name" /></div>
              <div><Label>Default Meta Description</Label><Input value={settings.seo_default_description || ""} onChange={(e) => update("seo_default_description", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Shipping & Payment</CardTitle></CardHeader>
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
              <div><Label>Instagram</Label><Input value={settings.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." /></div>
              <div><Label>Facebook</Label><Input value={settings.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." /></div>
              <div><Label>YouTube</Label><Input value={settings.youtube_url || ""} onChange={(e) => update("youtube_url", e.target.value)} placeholder="https://youtube.com/..." /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
