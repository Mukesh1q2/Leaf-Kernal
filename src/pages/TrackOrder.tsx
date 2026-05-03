import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, Circle, Package, Truck, Home, Clock } from "lucide-react";
import { format } from "date-fns";

const STEPS = [
  { key: "placed", label: "Order Placed", icon: Clock },
  { key: "packed", label: "Packed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];

const TrackOrder = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!orderId) return;
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      setOrder(o);
      const { data: d } = await (supabase.from("deliveries" as any) as any).select("*").eq("order_id", orderId).maybeSingle();
      setDelivery(d);
      setLoading(false);
    })();
  }, [orderId]);

  const currentIdx = delivery ? Math.max(0, STEPS.findIndex((s) => s.key === delivery.status)) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 max-w-3xl">
        <h1 className="text-3xl font-heading font-bold mb-2">Track Your Order</h1>
        {loading ? <p className="text-muted-foreground">Loading…</p> : !order ? (
          <p className="text-muted-foreground">Order not found. <Link to="/account" className="text-secondary underline">Back to account</Link></p>
        ) : (
          <>
            <p className="text-muted-foreground mb-8">Order #{order.id.slice(0, 8)} • Placed {format(new Date(order.created_at), "PPP")}</p>

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