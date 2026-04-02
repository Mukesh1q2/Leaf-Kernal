import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus } from "lucide-react";
import { format } from "date-fns";

const AdminReferrals = () => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from("referrals").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("referral_codes").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      setReferrals(r || []);
      setCodes(c || []);
    };
    load();
  }, []);

  const completed = referrals.filter(r => r.status === "completed").length;
  const rewardsGiven = referrals.filter(r => r.reward_given).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold text-foreground">Referral Program</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Referrals</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{referrals.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{completed}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Rewards Given</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{rewardsGiven}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active Codes</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{codes.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Referrals</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Referred Email</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No referrals yet</TableCell></TableRow>
              )}
              {referrals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-mono">{r.referrer_id.slice(0, 8)}...</TableCell>
                  <TableCell className="text-sm">{r.referred_email}</TableCell>
                  <TableCell className="text-sm font-mono">{r.referral_code}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.status === "completed" ? "bg-green-100 text-green-800" :
                      r.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-muted text-muted-foreground"
                    }`}>{r.status}</span>
                  </TableCell>
                  <TableCell>{r.reward_given ? "✅" : "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.created_at), "MMM dd, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReferrals;
