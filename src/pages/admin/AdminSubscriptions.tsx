import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Pause, Play, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Row = {
  id: string;
  user_id: string;
  quantity: number;
  cadence_days: number;
  discount_pct: number;
  status: string;
  next_charge_at: string;
  last_charge_at: string | null;
  created_at: string;
  product?: { name: string; slug: string } | null;
  profile?: { full_name: string | null } | null;
};

const AdminSubscriptions = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*, product:products(name,slug)")
      .order("next_charge_at", { ascending: true });
    // fetch profile names separately (no FK join)
    const ids = Array.from(new Set((data || []).map((r: any) => r.user_id)));
    let nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name || ""]));
    }
    setRows((data || []).map((r: any) => ({ ...r, profile: { full_name: nameMap.get(r.user_id) || null } })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("subscriptions").update({ status }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Updated" }); load(); }
  };
  const markCharged = async (id: string, cadence: number) => {
    const next = new Date(Date.now() + cadence * 86400000).toISOString();
    const { error } = await supabase.from("subscriptions").update({ last_charge_at: new Date().toISOString(), next_charge_at: next }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Marked as charged" }); load(); }
  };

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const dueNow = (r: Row) => r.status === "active" && new Date(r.next_charge_at) <= new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">Customer repeat-order schedules.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={load} className="p-2 border border-border rounded-lg hover:bg-muted" aria-label="Refresh"><RefreshCw size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">No subscriptions yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Qty × Cadence</th>
                <th className="text-left px-4 py-3">Discount</th>
                <th className="text-left px-4 py-3">Next charge</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`border-t border-border ${dueNow(r) ? "bg-gold-light/30" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.profile?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">{r.product?.name || "—"}</td>
                  <td className="px-4 py-3">{r.quantity} × every {r.cadence_days}d</td>
                  <td className="px-4 py-3">{r.discount_pct}%</td>
                  <td className="px-4 py-3">
                    {new Date(r.next_charge_at).toLocaleDateString()}
                    {dueNow(r) && <span className="ml-2 text-xs text-destructive font-semibold">Due</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "active" ? "bg-leaf/15 text-secondary" : r.status === "paused" ? "bg-gold-light text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {dueNow(r) && (
                        <button onClick={() => markCharged(r.id, r.cadence_days)} className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-leaf">Mark charged</button>
                      )}
                      {r.status === "active" && (
                        <button onClick={() => setStatus(r.id, "paused")} className="p-1.5 hover:bg-muted rounded" title="Pause"><Pause size={14} /></button>
                      )}
                      {r.status === "paused" && (
                        <button onClick={() => setStatus(r.id, "active")} className="p-1.5 hover:bg-muted rounded" title="Resume"><Play size={14} /></button>
                      )}
                      {r.status !== "cancelled" && (
                        <button onClick={() => setStatus(r.id, "cancelled")} className="p-1.5 hover:bg-destructive/10 rounded text-destructive" title="Cancel"><XCircle size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Note: subscription billing is currently manual — use "Mark charged" after processing the renewal to roll the next charge date.</p>
    </div>
  );
};

export default AdminSubscriptions;