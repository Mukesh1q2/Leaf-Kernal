import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Settings as SettingsIcon, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const SETTING_KEYS = [
  { key: "loyalty_signup_bonus", label: "Signup bonus (pts)" },
  { key: "loyalty_earn_per_rupees", label: "₹ per 1 point" },
  { key: "loyalty_redeem_rate", label: "Points per ₹1 discount" },
  { key: "loyalty_review_bonus", label: "Review bonus (pts)" },
  { key: "loyalty_max_redeem_pct", label: "Max redeem % per order" },
  { key: "loyalty_tier_silver_min", label: "Silver tier min (lifetime pts)" },
  { key: "loyalty_tier_gold_min", label: "Gold tier min (lifetime pts)" },
  { key: "loyalty_tier_silver_mult", label: "Silver multiplier" },
  { key: "loyalty_tier_gold_mult", label: "Gold multiplier" },
];

const AdminLoyalty = () => {
  const { toast } = useToast();
  const [points, setPoints] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [adjUserId, setAdjUserId] = useState("");
  const [adjPoints, setAdjPoints] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = async () => {
    const [{ data: p }, { data: b }, { data: s }] = await Promise.all([
      supabase.from("loyalty_points").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("loyalty_balances").select("*").order("total_points", { ascending: false }).limit(50),
      supabase.from("site_settings").select("key,value").in("key", SETTING_KEYS.map(s => s.key)),
    ]);
    setPoints(p || []);
    setBalances(b || []);
    setSettings(Object.fromEntries((s || []).map((r: any) => [r.key, r.value])));
  };
  useEffect(() => { reload(); }, []);

  const saveSetting = async (key: string, value: string) => {
    setSavingKey(key);
    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
    if (existing) {
      await supabase.from("site_settings").update({ value }).eq("key", key);
    } else {
      await supabase.from("site_settings").insert({ key, value });
    }
    setSavingKey(null);
    toast({ title: "Saved", description: `${key} updated.` });
  };

  const submitAdjust = async () => {
    if (!adjUserId || !adjPoints) return;
    const { error } = await (supabase as any).rpc("admin_adjust_loyalty", {
      p_user_id: adjUserId, p_points: parseInt(adjPoints, 10), p_reason: adjReason || "Manual",
    });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Points adjusted", description: `${adjPoints} pts applied.` });
    setAdjUserId(""); setAdjPoints(""); setAdjReason("");
    reload();
  };

  const totalPointsIssued = points.filter(p => p.type === "earn").reduce((s, p) => s + p.points, 0);
  const totalRedeemed = points.filter(p => p.type === "redeem").reduce((s, p) => s + Math.abs(p.points), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold text-foreground">Loyalty Points</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Issued</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{totalPointsIssued} pts</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Redeemed</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{totalRedeemed} pts</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active Members</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{balances.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="adjust"><UserPlus className="h-3.5 w-3.5 mr-1" /> Manual Adjust</TabsTrigger>
          <TabsTrigger value="settings"><SettingsIcon className="h-3.5 w-3.5 mr-1" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Transactions</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions yet</TableCell></TableRow>
              )}
              {points.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-mono">{p.user_id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.type === "earn" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {p.type}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold">{p.type === "earn" ? "+" : ""}{p.points}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.description || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(p.created_at), "MMM dd, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjust">
          <Card>
            <CardHeader><CardTitle className="text-sm">Adjust user points</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-xl">
              <p className="text-xs text-muted-foreground">Use positive value to credit, negative to deduct. All actions are logged in the ledger.</p>
              <div><Label>User ID</Label><Input value={adjUserId} onChange={(e) => setAdjUserId(e.target.value)} placeholder="uuid" /></div>
              <div><Label>Points (e.g. 100 or -50)</Label><Input type="number" value={adjPoints} onChange={(e) => setAdjPoints(e.target.value)} /></div>
              <div><Label>Reason</Label><Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Compensation, correction, promo..." /></div>
              <Button onClick={submitAdjust} disabled={!adjUserId || !adjPoints}>Apply adjustment</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-sm">Loyalty configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-2xl">
              {SETTING_KEYS.map((s) => (
                <div key={s.key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">{s.label}</Label>
                    <Input value={settings[s.key] ?? ""} onChange={(e) => setSettings({ ...settings, [s.key]: e.target.value })} />
                  </div>
                  <Button size="sm" variant="outline" disabled={savingKey === s.key} onClick={() => saveSetting(s.key, settings[s.key] ?? "")}>
                    {savingKey === s.key ? "Saving..." : "Save"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLoyalty;
