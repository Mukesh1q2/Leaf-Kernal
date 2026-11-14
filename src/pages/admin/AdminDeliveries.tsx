import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  fetchBigshipTracking,
  syncBigshipToDelivery,
  mapBigshipStatus,
  BigshipTrackingResult,
} from "@/services/bigshipTracking";
import { RefreshCw, ExternalLink, Truck, Check, AlertCircle } from "lucide-react";

const STATUSES = ["placed", "packed", "shipped", "out_for_delivery", "delivered", "returned"];

const AdminDeliveries = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ tracking_id: "", carrier: "", status: "placed", estimated_delivery: "" });
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [fetchingAwb, setFetchingAwb] = useState(false);
  const [previewBigship, setPreviewBigship] = useState<BigshipTrackingResult | null>(null);

  const load = async () => {
    const { data: o } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    const { data: d } = await (supabase.from("deliveries" as any) as any).select("*");
    const dmap = new Map((d || []).map((x: any) => [x.order_id, x]));
    setOrders((o || []).map((x: any) => ({ ...x, delivery: dmap.get(x.id) })));
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-deliveries-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openEdit = (order: any) => {
    setEditing(order);
    const d = order.delivery || {};
    setPreviewBigship(null);
    setForm({
      tracking_id: d.tracking_id || "",
      carrier: d.carrier || "",
      status: d.status || "placed",
      estimated_delivery: d.estimated_delivery || "",
    });

    if (d.tracking_id) {
      handleFetchAwbDetails(d.tracking_id);
    }
  };

  const handleFetchAwbDetails = async (awbNumber: string) => {
    const clean = awbNumber.trim();
    if (!clean) return;

    setFetchingAwb(true);
    try {
      const res = await fetchBigshipTracking(clean);
      if (res.success) {
        setPreviewBigship(res);
        setForm((prev: any) => ({
          ...prev,
          carrier: res.carrier || prev.carrier,
          status: res.mappedStatus || prev.status,
          estimated_delivery: res.estimatedDelivery ? res.estimatedDelivery.slice(0, 10) : prev.estimated_delivery,
        }));
        toast.info(`Bigship details loaded: ${res.carrier} (${res.rawStatus})`);
      } else {
        toast.warning(res.error || "Could not fetch Bigship details for this AWB.");
      }
    } catch {
      toast.error("Failed to connect to Bigship.");
    } finally {
      setFetchingAwb(false);
    }
  };

  const syncSingleOrder = async (orderId: string, trackingId?: string) => {
    if (!trackingId) {
      return toast.warning("Order has no tracking ID to sync.");
    }

    setSyncingOrderId(orderId);
    try {
      const res = await syncBigshipToDelivery(orderId, trackingId);
      if (res.success) {
        toast.success(`Synced order #${orderId.slice(0, 8)}: ${res.data?.rawStatus} (${res.data?.carrier})`);
        await load();
      } else {
        toast.error(res.error || "Failed to sync with Bigship.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sync failed.");
    } finally {
      setSyncingOrderId(null);
    }
  };

  const syncAllActiveOrders = async () => {
    const activeWithAwb = orders.filter(
      (o) => o.delivery?.tracking_id && o.delivery?.status !== "delivered" && o.status !== "cancelled"
    );

    if (activeWithAwb.length === 0) {
      return toast.info("No active in-transit shipments found with tracking IDs.");
    }

    setSyncingAll(true);
    let successCount = 0;

    for (const o of activeWithAwb) {
      try {
        const res = await syncBigshipToDelivery(o.id, o.delivery.tracking_id);
        if (res.success) successCount++;
      } catch {
        // Continue to next order
      }
    }

    setSyncingAll(false);
    toast.success(`Bigship sync complete: ${successCount}/${activeWithAwb.length} shipments updated.`);
    load();
  };

  const save = async () => {
    if (!editing) return;

    if (editing.status === "cancelled" && ["shipped", "out_for_delivery", "delivered"].includes(form.status)) {
      return toast.error("Cannot dispatch or deliver an order that is cancelled.");
    }

    const payload: any = {
      order_id: editing.id,
      tracking_id: form.tracking_id || null,
      carrier: form.carrier || null,
      status: form.status,
      estimated_delivery: form.estimated_delivery || null,
    };
    if (editing.delivery) {
      const { error } = await (supabase.from("deliveries" as any) as any).update(payload).eq("id", editing.delivery.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase.from("deliveries" as any) as any).insert(payload);
      if (error) return toast.error(error.message);
    }

    // Keep orders status synchronized
    if (form.status === "delivered" && editing.status !== "delivered") {
      await supabase.from("orders").update({ status: "delivered" }).eq("id", editing.id);
    } else if (["shipped", "out_for_delivery"].includes(form.status) && editing.status === "confirmed") {
      await supabase.from("orders").update({ status: "shipped" }).eq("id", editing.id);
    }

    toast.success("Delivery updated — customer notified");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Delivery Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage dispatches, assign AWBs, and sync real-time courier tracking via Bigship Logistics.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={syncAllActiveOrders}
          disabled={syncingAll}
          className="gap-2 self-start"
        >
          <RefreshCw size={14} className={syncingAll ? "animate-spin" : ""} />
          {syncingAll ? "Syncing All Shipments…" : "Sync All Active from Bigship"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Tracking / AWB</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const hasAwb = Boolean(o.delivery?.tracking_id);
                const isSyncing = syncingOrderId === o.id;

                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{format(new Date(o.created_at), "MMM dd")}</TableCell>
                    <TableCell className="text-xs">
                      {hasAwb ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <span>{o.delivery.tracking_id}</span>
                          <a
                            href="https://app.bigship.direct/shipment-tracking"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-secondary"
                            title="View on Bigship Portal"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{o.delivery?.carrier || "—"}</TableCell>
                    <TableCell className="text-xs capitalize">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          o.delivery?.status === "delivered"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : o.delivery?.status === "shipped" || o.delivery?.status === "out_for_delivery"
                            ? "bg-blue-500/10 text-blue-600"
                            : o.delivery?.status === "returned"
                            ? "bg-rose-500/10 text-rose-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {(o.delivery?.status || "placed").replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.delivery?.estimated_delivery
                        ? format(new Date(o.delivery.estimated_delivery), "MMM dd")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {hasAwb && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncSingleOrder(o.id, o.delivery.tracking_id)}
                            disabled={isSyncing}
                            className="h-8 px-2 text-xs text-secondary hover:text-secondary/80 gap-1"
                            title="Sync live status from Bigship"
                          >
                            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                            {isSyncing ? "Syncing…" : "Sync"}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openEdit(o)}>
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Delivery & Bigship Tracking</DialogTitle>
          </DialogHeader>

          {editing?.status === "cancelled" && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>Notice: This order is Cancelled. Fulfillment status cannot be set to Shipped or Delivered.</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium">Tracking ID / AWB</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.tracking_id}
                  onChange={(e) => setForm({ ...form, tracking_id: e.target.value })}
                  placeholder="e.g. SF4384997017BIH"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFetchAwbDetails(form.tracking_id)}
                  disabled={fetchingAwb || !form.tracking_id.trim()}
                  className="shrink-0 gap-1.5 text-xs"
                >
                  <RefreshCw size={12} className={fetchingAwb ? "animate-spin" : ""} />
                  {fetchingAwb ? "Fetching…" : "Auto-Fill"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Click Auto-Fill to fetch carrier and status directly from Bigship.
              </p>
            </div>

            {/* Preview Bigship Details Card */}
            {previewBigship && (
              <div className="p-3 rounded-lg bg-muted/60 border border-border text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    {previewBigship.courierImage && (
                      <img
                        src={previewBigship.courierImage}
                        alt="Courier"
                        className="w-4 h-4 object-contain rounded bg-white p-0.5 border"
                      />
                    )}
                    <span>{previewBigship.carrier}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-secondary font-bold">
                    {previewBigship.rawStatus}
                  </span>
                </div>
                {previewBigship.currentLocation && (
                  <p className="text-muted-foreground text-[11px]">
                    Current Hub: <span className="text-foreground">{previewBigship.currentLocation}</span>
                  </p>
                )}
                {previewBigship.latestMessage && (
                  <p className="text-muted-foreground text-[11px] italic">"{previewBigship.latestMessage}"</p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium">Carrier</Label>
              <Input
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                placeholder="e.g. Shadowfax, Xpressbees, Delhivery…"
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Fulfillment Stage</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => {
                    const isBlockedForCancelled =
                      editing?.status === "cancelled" && ["shipped", "out_for_delivery", "delivered"].includes(s);
                    return (
                      <SelectItem key={s} value={s} disabled={isBlockedForCancelled} className="capitalize text-xs">
                        {s.replace(/_/g, " ")} {isBlockedForCancelled ? "(Blocked - Cancelled)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Estimated Delivery Date</Label>
              <Input
                type="date"
                value={form.estimated_delivery}
                onChange={(e) => setForm({ ...form, estimated_delivery: e.target.value })}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save Delivery Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDeliveries;
