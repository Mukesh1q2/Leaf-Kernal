import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, Circle, Package, Truck, Home, Clock, LogIn, HelpCircle, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

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

function formatDateSafe(raw: any, formatPattern: string, fallback = "—"): string {
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

  // Guest order tracking input state
  const [guestOrderId, setGuestOrderId] = useState(orderId || "");
  const [guestEmail, setGuestEmail] = useState(searchParams.get("email") || "");
  const [guestSearching, setGuestSearching] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

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

      setDelivery({
        carrier: data.carrier,
        tracking_id: data.tracking_id,
        status: data.delivery_status,
        estimated_delivery: data.estimated_delivery,
        timeline: data.timeline || [],
        notes: data.notes,
      });
    } catch {
      setGuestError("Unable to retrieve tracking details right now. Please try again later.");
    } finally {
      setGuestSearching(false);
    }
  };

  useEffect(() => {
    (async () => {
      // 1. If user is signed in, query their authenticated order with order items
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
        setLoading(false);
        return;
      }

      // 2. If unauthenticated but email param and orderId are present in URL, try guest lookup
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

  const deliveryStatus = delivery?.status || (order?.status === "delivered" ? "delivered" : order?.status === "shipped" ? "shipped" : "placed");
  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === deliveryStatus));
  const isOverallLoading = authLoading || loading;

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGuestOrder(guestOrderId, guestEmail);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 max-w-3xl">
        <h1 className="text-3xl font-heading font-bold mb-2">Track Your Order</h1>
        {isOverallLoading ? (
          <div className="py-12 text-center text-muted-foreground animate-pulse">
            Verifying order details…
          </div>
        ) : !order ? (
          <div className="bg-card border rounded-2xl p-6 md:p-8 max-w-lg mx-auto my-8 space-y-6 shadow-sm">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-3">
                <Search size={24} />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground">Track Your Shipment</h2>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Enter your Order ID and the email address provided during checkout to view live tracking updates.
              </p>
            </div>

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
        ) : (
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
              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-secondary/15 text-secondary">
                  {order.status}
                </span>
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
                        <div className={`mt-0.5 rounded-full p-2 transition-colors ${done ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${active ? "text-secondary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                            <Icon className="inline h-4 w-4 mr-2" />{s.label}
                          </p>
                          {active && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Current status: <span className="capitalize font-medium text-foreground">{s.label}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shipment details card */}
            {delivery && (
              <div className="bg-card border rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Courier Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Carrier</span>
                    <span className="font-medium text-foreground">{delivery.carrier || "Doorstep Courier"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Tracking ID / AWB</span>
                    <span className="font-mono font-medium text-foreground">{delivery.tracking_id || "Processing"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Current Stage</span>
                    <span className="capitalize font-medium text-foreground">{delivery.status?.replace(/_/g, " ") || "Placed"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Estimated Delivery</span>
                    <span className="font-medium text-foreground">{formatDateSafe(delivery.estimated_delivery, "PPP", "In Transit (3-5 days)")}</span>
                  </div>
                </div>

                {Array.isArray(delivery.timeline) && delivery.timeline.length > 0 && (
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
                )}
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
