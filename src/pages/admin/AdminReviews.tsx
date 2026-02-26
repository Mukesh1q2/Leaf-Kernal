import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Star, Trash2 } from "lucide-react";

const AdminReviews = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const fetchReviews = async () => {
    const { data } = await supabase.from("reviews").select("*, products(name)").order("created_at", { ascending: false });
    setReviews(data || []);
  };

  useEffect(() => { fetchReviews(); }, []);

  const updateStatus = async (id: string, is_approved: boolean) => {
    await supabase.from("reviews").update({ is_approved }).eq("id", id);
    toast({ title: is_approved ? "Review approved" : "Review rejected" });
    fetchReviews();
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    await supabase.from("reviews").delete().eq("id", id);
    toast({ title: "Review deleted" });
    fetchReviews();
  };

  const filtered = filter === "all" ? reviews
    : filter === "pending" ? reviews.filter(r => !r.is_approved)
    : reviews.filter(r => r.is_approved);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Reviews</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviews</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No reviews found</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.products?.name || "Unknown"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} className={i < r.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.title || "—"}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{r.content || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.is_approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {r.is_approved ? "Approved" : "Pending"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!r.is_approved && (
                        <Button variant="ghost" size="icon" onClick={() => updateStatus(r.id, true)} title="Approve">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {r.is_approved && (
                        <Button variant="ghost" size="icon" onClick={() => updateStatus(r.id, false)} title="Reject">
                          <X className="h-4 w-4 text-yellow-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deleteReview(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReviews;
