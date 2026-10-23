import { useEffect, useState, useTransition } from "react";
import { useCmsAuth } from "@/components/admin/AdminLayout";
import {
  FeatureFlag,
  FeatureKey,
  getFeatureFlags,
  updateFeatureFlag,
} from "@/lib/featureFlags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  Lock,
  ExternalLink,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatKolkataDate } from "@/lib/adminReports";

export default function AdminFeatureControls() {
  const { isMaster } = useCmsAuth();
  const { user } = useAuth();
  const { toast } = useToast();

  const [flags, setFlags] = useState<Record<FeatureKey, FeatureFlag> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<FeatureKey | null>(null);

  // Confirmation modal state
  const [pendingChange, setPendingChange] = useState<{
    key: FeatureKey;
    targetEnabled: boolean;
    name: string;
  } | null>(null);

  const loadFlags = async (refresh = true) => {
    setLoading(true);
    setLoadError(null);
    try {
      const fetched = await getFeatureFlags(refresh);
      setFlags(fetched);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load feature controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags(true);
  }, []);

  // Format date in Asia/Kolkata
  const formatIST = (isoString?: string | null) => {
    if (!isoString) return "Never";
    return formatKolkataDate(isoString, true);
  };

  // Trigger confirmation dialog
  const requestToggle = (key: FeatureKey, nextEnabled: boolean) => {
    if (!flags) return;
    const flag = flags[key];
    if (!flag.is_configured) {
      toast({
        title: "Integration Unconfigured",
        description: flag.missing_dependency || "This feature cannot be enabled until its underlying integration is configured.",
        variant: "destructive",
      });
      return;
    }

    setPendingChange({
      key,
      targetEnabled: nextEnabled,
      name: flag.name,
    });
  };

  // Execute confirmed update
  const confirmToggle = async () => {
    if (!pendingChange) return;
    const { key, targetEnabled, name } = pendingChange;
    setPendingChange(null);
    setUpdatingKey(key);

    try {
      const result = await updateFeatureFlag(
        key,
        targetEnabled,
        Boolean(isMaster),
        user?.email
      );

      if (result.success) {
        toast({
          title: "Feature Updated",
          description: `"${name}" has been ${targetEnabled ? "enabled" : "disabled"}. Changes are active across sessions.`,
        });
        await loadFlags(true);
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Could not update setting.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "System Error",
        description: err?.message || "Unexpected failure during update.",
        variant: "destructive",
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  // If unauthorized non-master user somehow lands here
  if (!isMaster) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-heading text-destructive">
              Access Restricted: Master Administrator Only
            </CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Feature controls directly govern production analytics, discovery feeds, and storefront functionality.
              Your account lacks the <code className="text-xs bg-muted px-1 py-0.5 rounded">is_master</code> privilege.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">
              Feature Controls
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary font-semibold text-xs">
              <ShieldCheck className="w-3 h-3 mr-1 inline" /> Master Admin Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable platform capabilities in real time. Changes are persisted in PostgreSQL with audit timestamps.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadFlags(true)}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      {/* Safety Notice */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground mb-0.5">Fail-Safe Authorization Architecture</p>
          <p>
            Feature toggles are strictly protected by Row-Level Security and database RPC authorization.
            Disabled features cease executing at both the data-access layer and UI. Essential canonical SEO and core checkout plumbing remain permanently operational.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading && !flags ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading feature configuration...</span>
          </div>
        </div>
      ) : flags ? (
        <div className="space-y-8">
          {/* Group 1: Analytics & Reports */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Analytics & Reporting
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FeatureControlCard
                flag={flags.admin_analytics}
                isUpdating={updatingKey === "admin_analytics"}
                onToggle={(next) => requestToggle("admin_analytics", next)}
                formatIST={formatIST}
              />
              <FeatureControlCard
                flag={flags.csv_downloads}
                isUpdating={updatingKey === "csv_downloads"}
                onToggle={(next) => requestToggle("csv_downloads", next)}
                formatIST={formatIST}
              />
            </div>
          </div>

          {/* Group 2: Product Discovery & Feeds */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Product Discovery & Feeds
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureControlCard
                flag={flags.gmc_feed}
                isUpdating={updatingKey === "gmc_feed"}
                onToggle={(next) => requestToggle("gmc_feed", next)}
                formatIST={formatIST}
              />
              <FeatureControlCard
                flag={flags.meta_feed}
                isUpdating={updatingKey === "meta_feed"}
                onToggle={(next) => requestToggle("meta_feed", next)}
                formatIST={formatIST}
              />
              <FeatureControlCard
                flag={flags.product_structured_data}
                isUpdating={updatingKey === "product_structured_data"}
                onToggle={(next) => requestToggle("product_structured_data", next)}
                formatIST={formatIST}
              />
            </div>
          </div>

          {/* Group 3: Storefront & Recommendations */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Storefront Intelligence & Measurement
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FeatureControlCard
                flag={flags.botanical_recommendations}
                isUpdating={updatingKey === "botanical_recommendations"}
                onToggle={(next) => requestToggle("botanical_recommendations", next)}
                formatIST={formatIST}
              />
              <FeatureControlCard
                flag={flags.commerce_events}
                isUpdating={updatingKey === "commerce_events"}
                onToggle={(next) => requestToggle("commerce_events", next)}
                formatIST={formatIST}
              />
            </div>
          </div>

          {/* Group 4: Unavailable Integrations (No switches) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Unavailable Integrations (Audit Found Incomplete)
              </h3>
              <Badge variant="secondary" className="text-xs">
                Switches Disabled by Design
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <UnconfiguredIntegrationCard
                flag={flags.delhivery_tracking}
                formatIST={formatIST}
              />
              <UnconfiguredIntegrationCard
                flag={flags.razorpay_refunds}
                formatIST={formatIST}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={Boolean(pendingChange)}
        onOpenChange={(open) => !open && setPendingChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Confirm Feature State Modification
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to{" "}
                <span className="font-bold text-foreground">
                  {pendingChange?.targetEnabled ? "ENABLE" : "DISABLE"}
                </span>{" "}
                the feature <span className="font-semibold text-foreground">"{pendingChange?.name}"</span>?
              </p>
              {!pendingChange?.targetEnabled && (
                <p className="text-destructive font-medium text-xs">
                  Disabling this feature takes effect immediately across all active browser sessions and blocks corresponding data access.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggle}
              className={pendingChange?.targetEnabled ? "" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
            >
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Configured Active Feature Control Card
function FeatureControlCard({
  flag,
  isUpdating,
  onToggle,
  formatIST,
}: {
  flag: FeatureFlag;
  isUpdating: boolean;
  onToggle: (next: boolean) => void;
  formatIST: (iso?: string | null) => string;
}) {
  return (
    <Card className={`transition-all ${flag.is_enabled ? "border-primary/20 bg-card" : "border-border/60 bg-muted/20 opacity-80"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{flag.name}</CardTitle>
              {flag.is_enabled ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 h-4 font-medium">
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0 h-4 font-medium">
                  Disabled
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs line-clamp-2">
              {flag.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 pt-0.5 shrink-0">
            <Switch
              checked={flag.is_enabled}
              disabled={isUpdating}
              onCheckedChange={onToggle}
              aria-label={`Toggle ${flag.name}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-[11px] text-muted-foreground border-t border-border/40 mt-1 pt-2 flex items-center justify-between">
        <span>Modified: {formatIST(flag.updated_at)}</span>
        <span className="font-mono text-[10px] truncate max-w-[120px]">{flag.updated_by_email || "system"}</span>
      </CardContent>
    </Card>
  );
}

// Unconfigured Incomplete Integration Card
function UnconfiguredIntegrationCard({
  flag,
  formatIST,
}: {
  flag: FeatureFlag;
  formatIST: (iso?: string | null) => string;
}) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                {flag.name}
              </CardTitle>
              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 h-4 font-medium">
                Not configured
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {flag.description}
            </CardDescription>
          </div>
          <Lock className="w-4 h-4 text-amber-600/70 shrink-0 mt-0.5" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-xs space-y-2">
        <div className="p-2 rounded bg-background/80 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-mono leading-relaxed">
          <strong>Missing Foundation:</strong> {flag.missing_dependency || "Incomplete integration requirements"}
        </div>
        <p className="text-[11px] text-muted-foreground italic">
          Switch disabled to prevent false operational status. Real API integration required before enabling.
        </p>
      </CardContent>
    </Card>
  );
}
