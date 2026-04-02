import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award } from "lucide-react";
import { format } from "date-fns";

const AdminLoyalty = () => {
  const [points, setPoints] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase.from("loyalty_points").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("loyalty_balances").select("*").order("total_points", { ascending: false }).limit(50),
      ]);
      setPoints(p || []);
      setBalances(b || []);
    };
    load();
  }, []);

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
    </div>
  );
};

export default AdminLoyalty;
