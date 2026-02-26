import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList } from "lucide-react";

const AdminActivity = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("admin_activity_log").select("*").order("created_at", { ascending: false }).limit(100);
      setLogs(data || []);
    };
    load();
  }, []);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold text-foreground">Activity Log</h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No activity recorded yet</TableCell></TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      log.action === "create" ? "bg-green-100 text-green-800" :
                      log.action === "update" ? "bg-blue-100 text-blue-800" :
                      log.action === "delete" ? "bg-red-100 text-red-800" :
                      "bg-muted text-muted-foreground"
                    }`}>{log.action}</span>
                  </TableCell>
                  <TableCell className="text-sm">{log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {log.details && typeof log.details === "object" ? JSON.stringify(log.details).slice(0, 80) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{timeAgo(log.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminActivity;
