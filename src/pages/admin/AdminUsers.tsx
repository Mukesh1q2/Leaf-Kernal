import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Shield, UserPlus, Trash2, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  roles: AppRole[];
}

const ROLES: AppRole[] = ["admin", "moderator", "user", "content_manager", "inventory_manager", "customer_support"];

const roleBadgeColor: Record<AppRole, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  moderator: "bg-blue-100 text-blue-800 border-blue-200",
  user: "bg-gray-100 text-gray-800 border-gray-200",
  content_manager: "bg-purple-100 text-purple-800 border-purple-200",
  inventory_manager: "bg-amber-100 text-amber-800 border-amber-200",
  customer_support: "bg-green-100 text-green-800 border-green-200",
};

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("admin");
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    // Get all profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone");
    // Get all roles
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (!profiles) { setLoading(false); return; }

    const roleMap = new Map<string, AppRole[]>();
    (roles || []).forEach((r) => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
    });

    const merged: UserWithRoles[] = profiles.map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      roles: roleMap.get(p.user_id) || [],
    }));

    // Sort: users with roles first
    merged.sort((a, b) => b.roles.length - a.roles.length);
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const addRoleToUser = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);

    // Find user by email - look up in profiles by checking auth
    // We need to find the user_id from profiles. Since we can't query auth.users,
    // we'll search profiles. But profiles don't store email.
    // Instead, we'll use an RPC or just let the admin paste the user_id or email.
    // For now, search profiles by name — but ideally we match by user_id.
    
    // Let's check if the input looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(addEmail.trim());
    
    let userId = addEmail.trim();
    
    if (!isUUID) {
      // Search by name in profiles
      const { data: matches } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${addEmail.trim()}%`)
        .limit(1);
      
      if (!matches || matches.length === 0) {
        toast({ title: "User not found", description: "No user found with that name. Try using their User ID instead.", variant: "destructive" });
        setAdding(false);
        return;
      }
      userId = matches[0].user_id;
    }

    // Check if role already exists
    const existing = users.find(u => u.user_id === userId);
    if (existing?.roles.includes(addRole)) {
      toast({ title: "Role exists", description: "This user already has this role.", variant: "destructive" });
      setAdding(false);
      return;
    }

    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: addRole });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role assigned", description: `${addRole} role assigned successfully.` });
      setAddOpen(false);
      setAddEmail("");
      fetchUsers();
    }
    setAdding(false);
  };

  const removeRole = async (userId: string, role: AppRole) => {
    if (!confirm(`Remove "${role}" role from this user?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role removed" });
      fetchUsers();
    }
  };

  const filtered = users.filter(u => {
    if (!search) return u.roles.length > 0; // Show only users with roles by default
    const q = search.toLowerCase();
    return (u.full_name?.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q));
  });

  const adminCount = users.filter(u => u.roles.includes("admin")).length;
  const totalWithRoles = users.filter(u => u.roles.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> User Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Manage roles and permissions for your team</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Assign Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role to User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>User Name or User ID</Label>
                <Input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="Enter name or UUID" />
                <p className="text-xs text-muted-foreground mt-1">Search by name or paste their User ID</p>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={addRole} onValueChange={v => setAddRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addRoleToUser} disabled={adding} className="w-full">
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Assign Role
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{users.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Users with Roles</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalWithRoles}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Admins</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{adminCount}</p></CardContent>
        </Card>
      </div>

      <div>
        <Input placeholder="Search by name or user ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm mb-4" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
              ) : filtered.map(u => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}…</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map(r => (
                        <Badge key={r} variant="outline" className={`text-xs ${roleBadgeColor[r]}`}>
                          {r.replace(/_/g, " ")}
                          <button onClick={() => removeRole(u.user_id, r)} className="ml-1 hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => { setAddEmail(u.user_id); setAddOpen(true); }}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
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

export default AdminUsers;
