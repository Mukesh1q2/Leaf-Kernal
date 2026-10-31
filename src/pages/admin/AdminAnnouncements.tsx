import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Save,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Tag,
  Copy,
  Check,
  Smartphone,
  Monitor,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AnnouncementBarConfig,
  CouponOption,
  CouponLinkMode,
  AnnouncementStatus,
  fetchAllAnnouncementsForCms,
  saveAnnouncementInCms,
  deleteAnnouncementInCms,
  fetchPublicCouponsForCms,
  validateAnnouncementSchedule,
  formatAnnouncementText,
  formatCouponCallout,
  getActiveAnnouncement,
  DEFAULT_ANNOUNCEMENT_BAR,
} from "@/lib/announcements";

const TEMPLATE_PRESETS = [
  { label: "Standard", template: "Use code {code} for {discount}" },
  { label: "Save Value", template: "Save {discount} with code {code}" },
  { label: "Special Offer", template: "Special Offer: {discount} | Code: {code}" },
  { label: "Checkout Callout", template: "Use code {code} at checkout" },
];

export const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementBarConfig[]>([]);
  const [publicCoupons, setPublicCoupons] = useState<CouponOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Active form state
  const [form, setForm] = useState<AnnouncementBarConfig>({ ...DEFAULT_ANNOUNCEMENT_BAR });
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [annList, couponList] = await Promise.all([
        fetchAllAnnouncementsForCms(),
        fetchPublicCouponsForCms(),
      ]);
      setAnnouncements(annList);
      setPublicCoupons(couponList);

      if (annList.length > 0) {
        setForm(annList[0]);
        setEditingId(annList[0].id);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load announcement settings",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Selected coupon option inspection
  const selectedCouponOption = useMemo(() => {
    if (!form.selected_coupon_id && !form.selected_coupon_code) return null;
    return (
      publicCoupons.find(
        (c) =>
          c.id === form.selected_coupon_id ||
          (form.selected_coupon_code && c.code === form.selected_coupon_code)
      ) || null
    );
  }, [form.selected_coupon_id, form.selected_coupon_code, publicCoupons]);

  // Live preview computation using core resolver
  const livePreview = useMemo(() => {
    return getActiveAnnouncement([form], publicCoupons.map((c) => c.raw));
  }, [form, publicCoupons]);

  // Handle schedule changes with immediate validation
  const handleScheduleChange = (field: "starts_at" | "ends_at", value: string) => {
    const nextStarts = field === "starts_at" ? (value ? new Date(value).toISOString() : null) : form.starts_at;
    const nextEnds = field === "ends_at" ? (value ? new Date(value).toISOString() : null) : form.ends_at;

    const validation = validateAnnouncementSchedule(nextStarts, nextEnds);
    setScheduleError(validation.valid ? null : validation.error || null);

    setForm((prev) => ({
      ...prev,
      starts_at: nextStarts,
      ends_at: nextEnds,
    }));
  };

  const setSchedulePreset = (preset: "clear" | "weekend" | "7days" | "30days") => {
    const now = new Date();
    if (preset === "clear") {
      setForm((prev) => ({ ...prev, starts_at: null, ends_at: null }));
      setScheduleError(null);
      return;
    }

    const start = new Date(now);
    let end = new Date(now);

    if (preset === "weekend") {
      // Current or upcoming Friday to Sunday
      const day = now.getDay();
      const diffToFriday = (5 - day + 7) % 7;
      start.setDate(now.getDate() + (diffToFriday === 0 && now.getHours() >= 18 ? 0 : diffToFriday));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 2);
      end.setHours(23, 59, 59, 999);
    } else if (preset === "7days") {
      end.setDate(now.getDate() + 7);
    } else if (preset === "30days") {
      end.setDate(now.getDate() + 30);
    }

    setForm((prev) => ({
      ...prev,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    }));
    setScheduleError(null);
  };

  const handleSave = async (statusOverride?: AnnouncementStatus) => {
    if (scheduleError) {
      toast({
        title: "Schedule Date Error",
        description: scheduleError,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const toSave: AnnouncementBarConfig = {
      ...form,
      status: statusOverride || form.status,
    };

    const res = await saveAnnouncementInCms(toSave);
    setSaving(false);

    if (!res.success) {
      toast({
        title: "Failed to save announcement bar",
        description: res.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: toSave.status === "published" ? "Announcement Published!" : "Saved as Draft",
      description:
        toSave.status === "published"
          ? "Storefront announcement bar has been updated."
          : "Draft saved. This announcement will not be shown on the storefront.",
    });

    setForm(res.data || toSave);
    loadData();
  };

  const handleNewAnnouncement = () => {
    const newConfig: AnnouncementBarConfig = {
      ...DEFAULT_ANNOUNCEMENT_BAR,
      id: `announcement-${Date.now()}`,
      name: `Promotion ${announcements.length + 1}`,
      priority: announcements.length * 10,
    };
    setEditingId(newConfig.id);
    setForm(newConfig);
    setScheduleError(null);
  };

  const handleSelectAnnouncement = (item: AnnouncementBarConfig) => {
    setEditingId(item.id);
    setForm(item);
    setScheduleError(null);
  };

  const handleDelete = async (id: string) => {
    if (announcements.length <= 1) {
      toast({
        title: "Cannot Delete",
        description: "You must have at least one announcement configuration. You can disable it instead.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this announcement?")) return;

    await deleteAnnouncementInCms(id);
    toast({ title: "Announcement deleted" });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 animate-spin" />
          <span>Loading Announcement Bar Settings...</span>
        </div>
      </div>
    );
  }

  // Calculate live preview status
  const now = new Date();
  const isStarted = !form.starts_at || new Date(form.starts_at) <= now;
  const isEnded = form.ends_at && new Date(form.ends_at) <= now;
  const isCurrentlyScheduled = form.is_enabled && form.status === "published" && isStarted && !isEnded;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Announcement Bar</h2>
            <Badge variant={form.is_enabled ? "default" : "secondary"}>
              {form.is_enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant={form.status === "published" ? "outline" : "secondary"}>
              {form.status === "published" ? "Published" : "Draft"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage top announcement message, display schedule, free shipping threshold, and public coupon callouts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNewAnnouncement}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Announcement
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleSave("draft")}
            disabled={saving}
          >
            Save as Draft
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave("published")}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {/* Announcements Selector / List */}
      {announcements.length > 1 && (
        <Card className="border-muted bg-muted/20">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Configured Announcements ({announcements.length})
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">
                Higher priority runs first when schedules overlap
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Coupon Link</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((item) => {
                  const itemStarted = !item.starts_at || new Date(item.starts_at) <= now;
                  const itemEnded = item.ends_at && new Date(item.ends_at) <= now;
                  const isItemLive = item.is_enabled && item.status === "published" && itemStarted && !itemEnded;

                  return (
                    <TableRow
                      key={item.id}
                      className={editingId === item.id ? "bg-muted/50 font-medium" : ""}
                    >
                      <TableCell className="text-xs py-2.5">
                        <span className="cursor-pointer hover:underline" onClick={() => handleSelectAnnouncement(item)}>
                          {item.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isItemLive ? "bg-green-500 animate-pulse" : item.is_enabled ? "bg-amber-400" : "bg-muted-foreground"
                            }`}
                          />
                          <span className="text-xs">
                            {isItemLive ? "Live Now" : item.status === "draft" ? "Draft" : !item.is_enabled ? "Disabled" : "Scheduled"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2.5 font-mono">{item.priority}</TableCell>
                      <TableCell className="text-xs py-2.5 capitalize text-muted-foreground">
                        {item.coupon_link_mode === "none" ? "None" : item.coupon_link_mode === "automatic" ? "⚡ Auto Best" : `🎯 ${item.selected_coupon_code || "Manual"}`}
                      </TableCell>
                      <TableCell className="text-[11px] py-2.5 text-muted-foreground">
                        {item.starts_at || item.ends_at
                          ? `${item.starts_at ? new Date(item.starts_at).toLocaleDateString() : "Always"} → ${
                              item.ends_at ? new Date(item.ends_at).toLocaleDateString() : "Indefinite"
                            }`
                          : "Always Active"}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSelectAnnouncement(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* LIVE PREVIEW CONTAINER */}
      <Card className="border-primary/20 shadow-sm overflow-hidden bg-gradient-to-b from-background to-muted/20">
        <CardHeader className="py-3.5 px-5 border-b border-border/60 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-primary" /> Live Storefront Preview
                </CardTitle>
                {isCurrentlyScheduled ? (
                  <Badge className="bg-green-600/90 text-white text-[11px]">🟢 Live on Storefront</Badge>
                ) : form.status === "draft" ? (
                  <Badge variant="secondary" className="text-[11px]">Draft Mode (Hidden)</Badge>
                ) : !form.is_enabled ? (
                  <Badge variant="destructive" className="text-[11px]">Disabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-[11px]">Scheduled (Hidden Now)</Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-0.5">
                Exact render preview on desktop and mobile. Click the copy button to test interactive feedback.
              </CardDescription>
            </div>

            {/* Viewport switcher */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
              <Button
                variant={previewDevice === "desktop" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setPreviewDevice("desktop")}
              >
                <Monitor className="h-3.5 w-3.5 mr-1" /> Desktop
              </Button>
              <Button
                variant={previewDevice === "mobile" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setPreviewDevice("mobile")}
              >
                <Smartphone className="h-3.5 w-3.5 mr-1" /> Mobile (375px)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 flex flex-col items-center justify-center bg-muted/40 min-h-[160px]">
          {/* Simulated Viewport container */}
          <div
            className={`transition-all duration-300 w-full rounded-md shadow-md overflow-hidden border border-border/80 ${
              previewDevice === "mobile" ? "max-w-[375px]" : "max-w-4xl"
            }`}
          >
            {/* Announcement Strip */}
            {!livePreview ? (
              <div className="bg-muted p-4 text-center text-xs text-muted-foreground italic">
                (Announcement bar is currently disabled, in draft, or outside scheduled window — will not appear on storefront)
              </div>
            ) : (
              <aside
                role="region"
                aria-label="Store Announcement"
                className="bg-primary text-primary-foreground py-2 px-3 text-xs md:text-sm transition-all"
              >
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-secondary animate-pulse shrink-0" aria-hidden="true" />
                    <span>{livePreview.announcement_copy}</span>
                  </div>

                  {livePreview.coupon && (
                    <div className="inline-flex flex-wrap items-center justify-center gap-1.5 font-normal">
                      {livePreview.coupon.discount_label && (
                        <span className="font-semibold text-secondary-foreground bg-secondary/90 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider shrink-0">
                          {livePreview.coupon.discount_label}
                        </span>
                      )}

                      {livePreview.coupon.formatted_callout && (
                        <span className="hidden sm:inline text-primary-foreground/90 text-xs">
                          {livePreview.coupon.formatted_callout}
                        </span>
                      )}

                      <div className="flex items-center gap-1 ml-0.5 shrink-0">
                        <span className="text-primary-foreground/80 text-xs hidden sm:inline">Use code:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCopiedPreview(true);
                            setTimeout(() => setCopiedPreview(false), 2000);
                          }}
                          className="inline-flex items-center gap-1 font-mono font-bold bg-background text-foreground px-2 py-0.5 rounded text-xs hover:bg-muted transition-colors shadow-xs"
                          aria-label={`Test copy code ${livePreview.coupon.code}`}
                        >
                          <span>{livePreview.coupon.code}</span>
                          {copiedPreview ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* Mock Header Navigation underneath to give realistic context */}
            <div className="bg-background px-4 py-3 flex items-center justify-between border-t border-border/40">
              <div className="text-xs font-bold text-primary tracking-wide">LEAF & KERNEL</div>
              <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>Shop</span>
                <span>About</span>
                <span>Contact</span>
              </div>
              <div className="text-xs text-muted-foreground">Cart (0)</div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground mt-3 flex items-center gap-2">
            <Info className="h-3.5 w-3.5" />
            <span>Changes in the form below update this preview in real-time.</span>
          </div>
        </CardContent>
      </Card>

      {/* CONFIGURATION FORM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Core Controls & Message */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Announcement & Threshold
            </CardTitle>
            <CardDescription className="text-xs">
              Set the storewide announcement copy and free-shipping threshold.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="announcement-name">Configuration Label</Label>
              <Input
                id="announcement-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Festive Wellness Campaign"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Internal reference name for CMS staff.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label htmlFor="is-enabled-toggle" className="text-sm font-medium">Enable Announcement Bar</Label>
                <p className="text-xs text-muted-foreground">
                  Turn the top bar on or off on the storefront.
                </p>
              </div>
              <Switch
                id="is-enabled-toggle"
                checked={form.is_enabled}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_enabled: v }))}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Publication Status</Label>
              <RadioGroup
                value={form.status}
                onValueChange={(val: AnnouncementStatus) => setForm((p) => ({ ...p, status: val }))}
                className="grid grid-cols-2 gap-3 mt-1.5"
              >
                <div className={`flex items-center space-x-2 border rounded-md p-3 cursor-pointer ${form.status === "published" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="published" id="status-published" />
                  <Label htmlFor="status-published" className="cursor-pointer text-xs">
                    <span className="font-semibold block">Published</span>
                    <span className="text-muted-foreground block text-[10px]">Active on storefront</span>
                  </Label>
                </div>
                <div className={`flex items-center space-x-2 border rounded-md p-3 cursor-pointer ${form.status === "draft" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="draft" id="status-draft" />
                  <Label htmlFor="status-draft" className="cursor-pointer text-xs">
                    <span className="font-semibold block">Draft</span>
                    <span className="text-muted-foreground block text-[10px]">Staff-only preview</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="free-shipping-threshold">Free Shipping Threshold (₹)</Label>
              <Input
                id="free-shipping-threshold"
                type="number"
                min="0"
                step="1"
                value={form.free_shipping_threshold}
                onChange={(e) =>
                  setForm((p) => ({ ...p, free_shipping_threshold: Math.max(0, parseFloat(e.target.value) || 0) }))
                }
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Syncs with cart shipping fee calculation and replaces <code className="bg-muted px-1 rounded">&#123;threshold&#125;</code> in copy.
              </p>
            </div>

            <div>
              <Label htmlFor="announcement-copy">Announcement Copy</Label>
              <Input
                id="announcement-copy"
                value={form.announcement_copy}
                onChange={(e) => setForm((p) => ({ ...p, announcement_copy: e.target.value }))}
                placeholder="Free shipping on orders above ₹{threshold} 🌿 Pure Ayurvedic Superfoods"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">&#123;threshold&#125;</code> to dynamically embed ₹{form.free_shipping_threshold}.
              </p>
            </div>

            <div>
              <Label htmlFor="priority-input">Display Priority</Label>
              <Input
                id="priority-input"
                type="number"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 0 }))}
                className="mt-1 font-mono w-32"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                If multiple scheduled announcements are published simultaneously, the one with the highest priority is shown.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Promotional Coupon Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Promotional Coupon Link
            </CardTitle>
            <CardDescription className="text-xs">
              Link an eligible public coupon to appear inside the announcement bar.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Coupon Selection Mode</Label>
              <RadioGroup
                value={form.coupon_link_mode}
                onValueChange={(val: CouponLinkMode) => setForm((p) => ({ ...p, coupon_link_mode: val }))}
                className="grid grid-cols-3 gap-2 mt-1.5"
              >
                <div className={`flex flex-col items-start space-y-1 border rounded-md p-2.5 cursor-pointer ${form.coupon_link_mode === "automatic" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="automatic" id="mode-auto" />
                    <Label htmlFor="mode-auto" className="cursor-pointer font-semibold text-xs">⚡ Automatic</Label>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Best active public offer</span>
                </div>

                <div className={`flex flex-col items-start space-y-1 border rounded-md p-2.5 cursor-pointer ${form.coupon_link_mode === "manual" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="manual" id="mode-manual" />
                    <Label htmlFor="mode-manual" className="cursor-pointer font-semibold text-xs">🎯 Manual</Label>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Select specific coupon</span>
                </div>

                <div className={`flex flex-col items-start space-y-1 border rounded-md p-2.5 cursor-pointer ${form.coupon_link_mode === "none" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="none" id="mode-none" />
                    <Label htmlFor="mode-none" className="cursor-pointer font-semibold text-xs">🚫 None</Label>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Text & shipping only</span>
                </div>
              </RadioGroup>
            </div>

            {/* Manual Coupon Selector */}
            {form.coupon_link_mode === "manual" && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="coupon-selector">Select Public Coupon</Label>
                <Select
                  value={form.selected_coupon_id || ""}
                  onValueChange={(val) => {
                    const opt = publicCoupons.find((c) => c.id === val);
                    setForm((p) => ({
                      ...p,
                      selected_coupon_id: val,
                      selected_coupon_code: opt ? opt.code : null,
                    }));
                  }}
                >
                  <SelectTrigger id="coupon-selector" className="w-full">
                    <SelectValue placeholder="Choose a public coupon..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {publicCoupons.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No storefront public coupons found. Create a public coupon in CMS Coupons first.
                      </div>
                    ) : (
                      publicCoupons.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs">{c.code}</span>
                            <span className="text-muted-foreground text-xs">— {c.discount_label}</span>
                            <Badge
                              variant={
                                c.status === "active"
                                  ? "default"
                                  : c.status === "scheduled"
                                  ? "outline"
                                  : "destructive"
                              }
                              className="text-[10px] py-0 px-1"
                            >
                              {c.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Warning if selected coupon is ineligible */}
                {selectedCouponOption && !selectedCouponOption.is_eligible_now && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Selected Coupon Currently Ineligible ({selectedCouponOption.status})</p>
                      <p className="text-[11px] mt-0.5">
                        {selectedCouponOption.status_reason}. The storefront will safely omit this coupon code until it becomes active and valid, preventing deceptive messaging.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Automatic mode explanation */}
            {form.coupon_link_mode === "automatic" && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Intelligent Coupon Prioritization Active</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    The system evaluates all active public coupons and automatically selects the highest-value promotion (giving preference to site-wide promotions and higher discounts). If no coupons are eligible, the coupon portion is cleanly omitted.
                  </p>
                </div>
              </div>
            )}

            {/* Template editor */}
            {form.coupon_link_mode !== "none" && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="coupon-template">Coupon Callout Template</Label>
                <Input
                  id="coupon-template"
                  value={form.coupon_template}
                  onChange={(e) => setForm((p) => ({ ...p, coupon_template: e.target.value }))}
                  placeholder="Use code {code} for {discount}"
                  className="font-mono text-xs"
                />

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
                  {TEMPLATE_PRESETS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => setForm((prev) => ({ ...prev, coupon_template: p.template }))}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 pt-1">
                  <span>Variables:</span>
                  <code className="bg-muted px-1 rounded">&#123;code&#125;</code>
                  <code className="bg-muted px-1 rounded">&#123;discount&#125;</code>
                  <code className="bg-muted px-1 rounded">&#123;terms&#125;</code>
                  <code className="bg-muted px-1 rounded">&#123;threshold&#125;</code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Display Schedule */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Display Schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  Optionally specify start and end dates/times for automatic launch and expiry. Leave blank for evergreen.
                </CardDescription>
              </div>

              {/* Quick schedule presets */}
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSchedulePreset("weekend")}
                >
                  This Weekend
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSchedulePreset("7days")}
                >
                  Next 7 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSchedulePreset("30days")}
                >
                  Next 30 Days
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setSchedulePreset("clear")}
                >
                  Always Active
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="schedule-starts-at">Start Date & Time</Label>
                <Input
                  id="schedule-starts-at"
                  type="datetime-local"
                  value={form.starts_at ? new Date(form.starts_at).toISOString().slice(0, 16) : ""}
                  onChange={(e) => handleScheduleChange("starts_at", e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Optional. Bar will remain hidden until this date.
                </p>
              </div>

              <div>
                <Label htmlFor="schedule-ends-at">End Date & Time</Label>
                <Input
                  id="schedule-ends-at"
                  type="datetime-local"
                  value={form.ends_at ? new Date(form.ends_at).toISOString().slice(0, 16) : ""}
                  onChange={(e) => handleScheduleChange("ends_at", e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Optional. Bar will automatically expire after this date.
                </p>
              </div>
            </div>

            {scheduleError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{scheduleError}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
        <div className="text-xs text-muted-foreground">
          Storefront updates apply immediately upon saving.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("draft")}
            disabled={saving}
          >
            Save as Draft
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave("published")}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Publishing..." : "Publish to Storefront"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncements;
