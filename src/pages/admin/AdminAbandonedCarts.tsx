import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ShoppingCart, TrendingDown, DollarSign, Mail } from "lucide-react";

const AdminAbandonedCarts = () => {
  const [carts, setCarts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("abandoned_carts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setCarts(data || []);
    };
    load();
  }, []);

  const totalLost = carts.filter(c => !c.recovered).reduce((s, c) => s + Number(c.cart_total || 0), 0);
  const totalRecovered = carts.filter(c => c.recovered).reduce((s, c) => s + Number(c.cart_total || 0), 0);
  const recoveryRate = carts.length > 0 ? Math.round((carts.filter(c => c.recovered).length / carts.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold text-foreground">Abandoned Cart Analytics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Total Abandoned</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{carts.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Lost Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-destructive">₹{totalLost.toLocaleString("en-IN")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Recovered</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-primary">₹{totalRecovered.toLocaleString("en-IN")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Recovery Rate</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{recoveryRate}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Cart Value</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Email Sent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No abandoned carts tracked yet</TableCell></TableRow>
              )}
              {carts.map(c => {
                const items = Array.isArray(c.cart_snapshot) ? c.cart_snapshot : [];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{format(new Date(c.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{c.user_id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-semibold">₹{Number(c.cart_total).toFixed(0)}</TableCell>
                    <TableCell>{items.length} items</TableCell>
                    <TableCell>{c.recovery_email_sent ? <Badge variant="secondary">Sent</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                    <TableCell>
                      <Badge variant={c.recovered ? "default" : "destructive"}>
                        {c.recovered ? "Recovered" : "Lost"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAbandonedCarts;
