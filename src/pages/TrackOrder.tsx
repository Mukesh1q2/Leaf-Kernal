import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  CheckCircle2,
  Circle,
  Package,
  Truck,
  Home,
  Clock,
  LogIn,
  HelpCircle,
  Search,
  Loader2,
  ExternalLink,
  RefreshCw,
  MapPin,
  Calendar,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import {
  fetchBigshipTracking,
  mapBigshipStatus,
  BigshipTrackingResult,
} from "@/services/bigshipTracking";

const STEPS = [
  { key: "placed", label: "Order Placed", icon: Clock },
  { key: "packed", label: "Packed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];

export type TrackingAccessState = "loading" | "unauthenticated" | "not_found" | "owner";

export function resolveTrackingAccess({
  authLoading,
  queryLoading,
  user,
  order,
}: {
  authLoading: boolean;
  queryLoading: boolean;
  user: { id: string; email?: string } | null;
  order: { id: string; user_id?: string; status: string } | null;
}): TrackingAccessState {
  if (authLoading || queryLoading) return "loading";
  if (!user) return "unauthenticated";
  if (!order) return "not_found";
  return "owner";
}

export function formatDateSafe(raw: any, formatPattern: string, fallback = "—"): string {
  if (!raw) return fallback;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return fallback;
  try {
    return format(d, formatPattern);
  } catch {
    return fallback;
  }
}

const TrackOrder = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Search mode: 'order' (Order ID + Email) or 'awb' (Direct Tracking Number / AWB)
  const [searchMode, setSearchMode] = useState<"order" | "awb">("order");

  // Guest order tracking input state
  const [guestOrderId, setGuestOrderId] = useState(orderId || "");
  const [guestEmail, setGuestEmail] = useState(searchParams.get("email") || "");
  const [guestSearching, setGuestSearching] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  // Direct AWB search state
  const [awbInput, setAwbInput] = useState(searchParams.get("awb") || "");
  const [awbSearching, setAwbSearching] = useState(false);
  const [awbResult, setAwbResult] = useState<BigshipTrackingResult | null>(null);
  const [awbError, setAwbError] = useState<string | null>(null);

  // Bigship Live Tracking state for active order
  const [bigshipTracking, setBigshipTracking] = useState<BigshipTrackingResult | null>(null);
  const [bigshipLoading, setBigshipLoading] = useState(false);

  const loadBigshipForDelivery = async (awbNumber: string) => {
    if (!awbNumber) return;
    setBigshipLoading(true);
    try {
      const result = await fetchBigshipTracking(awbNumber);
      if (result.success) {
        setBigshipTracking(result);
      }
    } catch {
      // Graceful fallback to database delivery data
    } finally {
      setBigshipLoading(false);
    }
  };

  const fetchGuestOrder = async (targetOrderId: string, targetEmail: string) => {
    const cleanId = targetOrderId.trim();
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanId || !cleanEmail) {
      setGuestError("Please enter both your Order ID and billing email.");
      return;
    }

    setGuestSearching(true);
    setGuestError(null);
    try {
      const { data, error } = await supabase.rpc("track_order_public", {
        p_order_id: cleanId,
        p_email: cleanEmail,
      });

      if (error || !data) {
        setGuestError("No order found matching this Order ID and email address. Please double check your details.");
        setGuestSearching(false);
        return;
      }

      setOrder({
        id: data.order_id,
        status: data.status,
        created_at: data.created_at,
        total: data.total,
        recipient_name: data.recipient_name,
        shipping_city: data.shipping_city,
        shipping_state: data.shipping_state,
      });

      const d = {
        carrier: data.carrier,
        tracking_id: data.tracking_id,
        status: data.delivery_status,
        estimated_delivery: data.estimated_delivery,
        timeline: data.timeline || [],
        notes: data.notes,
      };
      setDelivery(d);

      if (d.tracking_id) {
        loadBigshipForDelivery(d.tracking_id);
      }
    } catch {
      setGuestError("Unable to retrieve tracking details right now. Please try again later.");
    } finally {
      setGuestSearching(false);
    }
  };

  const handleDirectAwbSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = awbInput.trim();
    if (!clean) {
      setAwbError("Please enter an AWB tracking number.");
      return;
    }

    setAwbSearching(true);
    setAwbError(null);
    setAwbResult(null);

    try {
      const result = await fetchBigshipTracking(clean);
      if (result.success) {
        setAwbResult(result);
      } else {
        setAwbError(result.error || "No shipment found for this tracking number.");
      }
    } catch {
      setAwbError("Failed to reach tracking server. Please try again in a few moments.");
    } finally {
      setAwbSearching(false);
    }
  };

  useEffect(() => {
    (async () => {
      // 1. If AWB parameter is present in URL, auto-track directly
      const awbParam = searchParams.get("awb");
      if (awbParam) {
        setSearchMode("awb");
        setAwbInput(awbParam);
        setAwbSearching(true);
        const res = await fetchBigshipTracking(awbParam);
        if (res.success) {
          setAwbResult(res);
        } else {
          setAwbError(res.error || "Shipment not found.");
        }
        setAwbSearching(false);
        setLoading(false);
        return;
      }

      // 2. If user is signed in, query their authenticated order with order items
      if (user && orderId) {
        setLoading(true);
        const { data: o } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", orderId)
          .maybeSingle();
        setOrder(o);
        const { data: d } = await (supabase.from("deliveries" as any) as any)
          .select("*")
          .eq("order_id", orderId)
          .maybeSingle();
        setDelivery(d);

        if (d?.tracking_id) {
          loadBigshipForDelivery(d.tracking_id);
        }
        setLoading(false);
        return;
      }

      // 3. If unauthenticated but email param and orderId are present in URL, try guest lookup
      const emailParam = searchParams.get("email");
      if (!user && orderId && emailParam) {
        setLoading(true);
        await fetchGuestOrder(orderId, emailParam);
        setLoading(false);
        return;
      }

      setLoading(false);
    })();
  }, [orderId, user]);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`track-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries", filter: `order_id=eq.${orderId}` },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as any;
            setDelivery((prev: any) => ({ ...prev, ...updated }));
            if (updated.tracking_id) {
              loadBigshipForDelivery(updated.tracking_id);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          if (payload.new) {
            setOrder((prev: any) => ({ ...prev, ...(payload.new as any) }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Compute active stage using Bigship live status if available, fallback to delivery/order
  const liveStatus = bigshipTracking?.mappedStatus || delivery?.status || (order?.status === "delivered" ? "delivered" : order?.status === "shipped" ? "shipped" : "placed");
  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === liveStatus));
  const isOverallLoading = authLoading || loading;

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGuestOrder(guestOrderId, guestEmail);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Track Your Order</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time shipment updates powered by Leaf & Kernel and Bigship Logistics.
            </p>
          </div>
          {delivery?.tracking_id && (
            <button
              onClick={() => loadBigshipForDelivery(delivery.tracking_id)}
              disabled={bigshipLoading}
              className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 font-medium border border-border rounded-lg px-2.5 py-1.5 self-start transition-colors bg-card"
              title="Refresh live courier status"
            >
              <RefreshCw size={13} className={bigshipLoading ? "animate-spin" : ""} />
              {bigshipLoading ? "Syncing courier…" : "Sync Live Status"}
            </button>
          )}
        </div>

        {isOverallLoading ? (
          <div className="py-12 text-center text-muted-foreground animate-pulse flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-secondary" />
            <span>Verifying order & tracking details…</span>
          </div>
        ) : !order && !awbResult ? (
          <div className="bg-card border rounded-2xl p-6 md:p-8 max-w-lg mx-auto my-8 space-y-6 shadow-sm">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-3">
                <Truck size={24} />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground">Track Your Shipment</h2>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Check live courier milestones, dispatched carrier, and estimated doorstep delivery.
              </p>
            </div>

            {/* Toggle Tabs between Order ID lookup and Direct AWB tracking */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSearchMode("order")}
                className={`py-2 rounded-md transition-all ${
                  searchMode === "order"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Order ID & Email
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("awb")}
                className={`py-2 rounded-md transition-all ${
                  searchMode === "awb"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tracking ID / AWB
              </button>
            </div>

            {searchMode === "order" ? (
              <form onSubmit={handleGuestSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Order ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 66666666-6666-6666-6666-666666666601"
                    value={guestOrderId}
                    onChange={(e) => {
                      setGuestOrderId(e.target.value);
                      if (guestError) setGuestError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    placeholder="your.email@example.com"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      if (guestError) setGuestError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    required
                  />
                </div>

                {guestError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    {guestError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={guestSearching}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-60 text-sm"
                >
                  {guestSearching ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Verifying Order...
                    </>
                  ) : (
                    <>
                      <Search size={16} /> Track Shipment
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleDirectAwbSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    AWB / Courier Tracking Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SF4384997017BIH, 152724550046092"
                    value={awbInput}
                    onChange={(e) => {
                      setAwbInput(e.target.value);
                      if (awbError) setAwbError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 font-mono"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Enter the tracking number sent in your dispatch SMS or email.
                  </p>
                </div>

                {awbError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    {awbError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={awbSearching}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-60 text-sm"
                >
                  {awbSearching ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Fetching Live Status...
                    </>
                  ) : (
                    <>
                      <Truck size={16} /> Track via Bigship
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3 justify-between items-center text-xs text-muted-foreground">
              {!user ? (
                <Link
                  to={`/auth?next=${encodeURIComponent(orderId ? `/track/${orderId}` : "/account")}`}
                  className="inline-flex items-center gap-1.5 text-secondary hover:underline font-medium"
                >
                  <LogIn size={14} /> Have an account? Sign In
                </Link>
              ) : (
                <Link to="/account?tab=orders" className="inline-flex items-center gap-1.5 text-secondary hover:underline font-medium">
                  View Account Orders
                </Link>
              )}
              <Link to="/contact" className="inline-flex items-center gap-1.5 hover:underline">
                <HelpCircle size={14} /> Need Help?
              </Link>
            </div>
          </div>
        ) : awbResult ? (
          /* Standalone Direct AWB Tracking Card */
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                {awbResult.courierImage ? (
                  <img
                    src={awbResult.courierImage}
                    alt={awbResult.carrier}
                    className="w-10 h-10 object-contain p-1 rounded-lg border bg-white"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                    <Truck size={20} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{awbResult.carrier}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-semibold uppercase tracking-wider">
                      Bigship Direct
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">AWB: {awbResult.trackingNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider bg-secondary/15 text-secondary">
                  {awbResult.rawStatus}
                </span>
                <button
                  onClick={() => {
                    setAwbResult(null);
                    setAwbInput("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                >
                  New Search
                </button>
              </div>
            </div>

            {/* Stepper for direct AWB */}
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4">Shipment Progress</h3>
              <div className="space-y-6">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const mappedIdx = STEPS.findIndex((st) => st.key === awbResult.mappedStatus);
                  const activeIdx = mappedIdx >= 0 ? mappedIdx : 0;
                  const done = i <= activeIdx;
                  const active = i === activeIdx;
                  return (
                    <div key={s.key} className="flex items-start gap-4">
                      <div
                        className={`mt-0.5 rounded-full p-2 transition-colors ${
                          done ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold text-sm ${
                            active ? "text-secondary" : done ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          <Icon className="inline h-4 w-4 mr-2" />
                          {s.label}
                        </p>
                        {active && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Status: <span className="capitalize font-medium text-foreground">{awbResult.rawStatus}</span>
                            {awbResult.currentLocation && ` at ${awbResult.currentLocation}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Courier Details Grid */}
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground">Delivery Information</h3>
                <a
                  href={awbResult.directTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-secondary hover:underline font-medium"
                >
                  Open Bigship Portal <ExternalLink size={12} />
                </a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Dispatched By</span>
                  <span className="font-semibold text-foreground text-sm">{awbResult.carrier}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Current Location</span>
                  <span className="font-medium text-foreground text-sm flex items-center gap-1">
                    <MapPin size={13} className="text-secondary shrink-0" />
                    {awbResult.currentLocation || "In Transit Hub"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Estimated Delivery</span>
                  <span className="font-medium text-foreground text-sm flex items-center gap-1">
                    <Calendar size={13} className="text-secondary shrink-0" />
                    {awbResult.estimatedDelivery || "Expected 3-5 days"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Last Scanned</span>
                  <span className="font-medium text-foreground text-sm">
                    {awbResult.lastScan || formatDateSafe(awbResult.latestCheckpointTime, "PPp")}
                  </span>
                </div>
              </div>

              {/* Checkpoints Timeline */}
              {awbResult.checkpoints && awbResult.checkpoints.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Courier Checkpoint Activity
                  </h4>
                  <div className="space-y-3">
                    {awbResult.checkpoints.map((cp, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs">
                        <span className="text-secondary font-bold mt-0.5">•</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{cp.tag || cp.order_status}</span>
                            {cp.location && (
                              <span className="text-[11px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono">
                                {cp.location}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-auto">
                              {formatDateSafe(cp.checkpoint_time, "PPp")}
                            </span>
                          </div>
                          {cp.message && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{cp.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Order-based tracking view */
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Order #{order.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Placed on {formatDateSafe(order.created_at, "PPP")}
                </p>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-secondary/15 text-secondary">
                  {order.status}
                </span>
                {delivery?.tracking_id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wider">
                    Bigship Verified
                  </span>
                )}
              </div>
            </div>

            {order.status === "cancelled" ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-6 text-center space-y-2">
                <p className="text-lg font-heading font-bold text-destructive">Order Cancelled</p>
                <p className="text-sm text-muted-foreground">
                  This order has been cancelled and will not be dispatched. If payment was completed, any eligible refund will be credited in accordance with our policy.
                </p>
              </div>
            ) : (
              <div className="bg-card border rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4">Shipment Progress</h3>
                <div className="space-y-6">
                  {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const done = i <= currentIdx;
                    const active = i === currentIdx;
                    return (
                      <div key={s.key} className="flex items-start gap-4">
                        <div
                          className={`mt-0.5 rounded-full p-2 transition-colors ${
                            done ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm ${
                              active ? "text-secondary" : done ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <Icon className="inline h-4 w-4 mr-2" />
                            {s.label}
                          </p>
                          {active && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Current status:{" "}
                              <span className="capitalize font-medium text-foreground">
                                {bigshipTracking?.rawStatus || s.label}
                              </span>
                              {bigshipTracking?.currentLocation && ` (${bigshipTracking.currentLocation})`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shipment details card with live Bigship data */}
            {delivery && (
              <div className="bg-card border rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    {bigshipTracking?.courierImage ? (
                      <img
                        src={bigshipTracking.courierImage}
                        alt={bigshipTracking.carrier}
                        className="w-7 h-7 object-contain bg-white rounded p-0.5 border"
                      />
                    ) : (
                      <Truck size={18} className="text-secondary" />
                    )}
                    <h3 className="font-semibold text-sm text-foreground">
                      Courier & Logistics Details
                    </h3>
                  </div>

                  {delivery.tracking_id && (
                    <a
                      href={`https://app.bigship.direct/shipment-tracking`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-secondary hover:underline font-medium"
                    >
                      Bigship Tracking <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Carrier</span>
                    <span className="font-medium text-foreground">
                      {bigshipTracking?.carrier || delivery.carrier || "Bigship Direct Logistics"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Tracking ID / AWB</span>
                    <span className="font-mono font-medium text-foreground">
                      {delivery.tracking_id || "Processing Allocation"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Live Stage</span>
                    <span className="capitalize font-medium text-foreground">
                      {bigshipTracking?.rawStatus || delivery.status?.replace(/_/g, " ") || "Placed"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Estimated Delivery</span>
                    <span className="font-medium text-foreground">
                      {bigshipTracking?.estimatedDelivery ||
                        formatDateSafe(delivery.estimated_delivery, "PPP", "In Transit (3-5 days)")}
                    </span>
                  </div>
                </div>

                {/* Bigship real-time checkpoints or local timeline */}
                {bigshipTracking?.checkpoints && bigshipTracking.checkpoints.length > 0 ? (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Live Tracking Milestones (Bigship)
                      </h4>
                      {bigshipTracking.lastScan && (
                        <span className="text-[11px] text-muted-foreground">
                          Last scanned: {bigshipTracking.lastScan}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-2 text-xs">
                      {bigshipTracking.checkpoints.map((cp, i) => (
                        <li key={i} className="flex items-start gap-2 text-muted-foreground">
                          <span className="text-secondary font-bold">•</span>
                          <div className="flex-1">
                            <span className="font-semibold capitalize text-foreground">
                              {cp.tag || cp.order_status}
                            </span>
                            {cp.location && (
                              <span className="ml-1 text-[11px] px-1 bg-muted rounded font-mono">
                                {cp.location}
                              </span>
                            )}
                            {" — "}
                            <span>{formatDateSafe(cp.checkpoint_time, "PPp")}</span>
                            {cp.message && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{cp.message}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : Array.isArray(delivery.timeline) && delivery.timeline.length > 0 ? (
                  <div className="mt-5 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                      Activity Timeline
                    </h4>
                    <ul className="space-y-2 text-xs">
                      {delivery.timeline.map((t: any, i: number) => {
                        const timeVal = t.timestamp || t.at || t.created_at || t.date;
                        return (
                          <li key={i} className="flex items-start gap-2 text-muted-foreground">
                            <span className="text-secondary font-bold">•</span>
                            <div className="flex-1">
                              <span className="font-semibold capitalize text-foreground">
                                {t.status?.replace(/_/g, " ")}
                              </span>
                              {" — "}
                              <span>{formatDateSafe(timeVal, "PPp")}</span>
                              {t.message && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{t.message}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            {/* Order Items Breakdown */}
            {Array.isArray(order.order_items) && order.order_items.length > 0 && (
              <div className="bg-card border rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Items in this Order</h3>
                <div className="divide-y divide-border">
                  {order.order_items.map((item: any) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product_image || "/placeholder.svg"}
                          alt={item.product_name || "Product"}
                          className="w-12 h-12 object-cover rounded-md border border-border"
                        />
                        <div>
                          <p className="font-medium text-sm text-foreground">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-semibold text-sm text-foreground">
                        ₹{Number(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link
                to="/account?tab=orders"
                className="text-sm font-medium text-secondary hover:underline inline-flex items-center gap-1"
              >
                ← Back to Order History
              </Link>
              <Link
                to="/contact"
                className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
              >
                <HelpCircle size={13} /> Need assistance?
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrder;
