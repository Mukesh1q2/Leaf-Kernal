import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, Circle, Package, Truck, Home, Clock, ShieldCheck, LogIn, HelpCircle } from "lucide-react";
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

const TrackOrder = () => {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      // If user is not authenticated, do not query DB since RLS strictly requires authentication
      if (!user) {
        setOrder(null);
        setDelivery(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      setOrder(o);
      const { data: d } = await (supabase.from("deliveries" as any) as any).select("*").eq("order_id", orderId).maybeSingle();
      setDelivery(d);
      setLoading(false);
    })();
  }, [orderId, user]);

  const currentIdx = delivery ? Math.max(0, STEPS.findIndex((s) => s.key === delivery.status)) : 0;
  const isOverallLoading = authLoading || loading;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 max-w-3xl">
        <h1 className="text-3xl font-heading font-bold mb-2">Track Your Order</h1>
        {isOverallLoading ? (
          <div className="py-12 text-center text-muted-foreground animate-pulse">
            Verifying order details…
          </div>
        ) : !user ? (
          <div className="bg-card border rounded-2xl p-8 text-center max-w-lg mx-auto my-8 space-y-4 shadow-sm">
            <div className="mx-auto w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground">Sign In to View Order Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To protect customer privacy and shipping information, tracking updates are only accessible when signed in to the account that placed the order.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={`/auth?next=${encodeURIComponent(orderId ? `/track/${orderId}` : "/account")}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors"
              >
                <LogIn size={16} /> Sign In to Your Account
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-muted transition-colors"
              >
                <HelpCircle size={16} /> Need Help?
              </Link>
            </div>
          </div>
        ) : !order ? (
          <div className="bg-card border rounded-2xl p-8 text-center max-w-lg mx-auto my-8 space-y-4 shadow-sm">
            <h2 className="text-xl font-heading font-bold text-foreground">No order found for this account</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We couldn't find an order matching this ID under your signed-in account. Please verify the order ID in your confirmation email, or check your account's order history.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/account"
                className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors"
              >
                View My Orders
              </Link>
              <Link
                to="/contact"
                className="px-6 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-muted transition-colors"
              >
                Contact Customer Care
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-8">Order #{order.id.slice(0, 8)} • Placed {format(new Date(order.created_at), "PPP")}</p>

            {order.status === "cancelled" ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-6 text-center space-y-2">
                <p className="text-lg font-heading font-bold text-destructive">Order Cancelled</p>
                <p className="text-sm text-muted-foreground">
                  This order has been cancelled and will not be dispatched. If payment was completed, any eligible refund will be credited in accordance with our policy.
                </p>
              </div>
            ) : (
              <div className="bg-card border rounded-lg p-6 mb-6">
                <div className="space-y-6">
                  {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const done = i <= currentIdx;
                    const active = i === currentIdx;
                    return (
                      <div key={s.key} className="flex items-start gap-4">
                        <div className={`mt-0.5 rounded-full p-2 ${done ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold ${active ? "text-secondary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                            <Icon className="inline h-4 w-4 mr-2" />{s.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {delivery && (
              <div className="bg-card border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Shipment Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Carrier:</span> {delivery.carrier || "—"}</div>
                  <div><span className="text-muted-foreground">Tracking ID:</span> {delivery.tracking_id || "—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{delivery.status.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">ETA:</span> {delivery.estimated_delivery ? format(new Date(delivery.estimated_delivery), "PPP") : "—"}</div>
                </div>
                {Array.isArray(delivery.timeline) && delivery.timeline.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2">Timeline</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {delivery.timeline.map((t: any, i: number) => (
                        <li key={i} className="capitalize">• {t.status.replace(/_/g, " ")} — {format(new Date(t.at), "PPp")}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrder;