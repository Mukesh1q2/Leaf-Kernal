import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

const AdminInquiries = () => {
  const [items, setItems] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("contact_inquiries").select("*").order("created_at", { ascending: false }).limit(100);
    setItems(data || []);
  };
  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("contact_inquiries").update({ status }).eq("id", id);
    toast({ title: `Marked as ${status}` });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold text-foreground">Contact Inquiries</h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No inquiries yet</TableCell></TableRow>
              )}
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm">{i.email}</TableCell>
                  <TableCell className="text-sm">{i.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{i.message}</TableCell>
                  <TableCell>
                    <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(i.created_at), "MMM dd, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInquiries;
