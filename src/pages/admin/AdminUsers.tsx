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
import { Users, Shield, UserPlus, Trash2, Loader2, Crown } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useCmsAuth } from "@/components/admin/AdminLayout";

type AppRole = Database["public"]["Enums"]["app_role"] | "editor";

interface UserWithRoles {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  roles: AppRole[];
  masterRoles: Set<AppRole>;
}

const ROLES: AppRole[] = [
  "admin",
  "editor",
  "moderator",
  "user",
  "content_manager",
  "inventory_manager",
  "customer_support",
];

const roleBadgeColor: Record<string, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  editor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderator: "bg-blue-100 text-blue-800 border-blue-200",
  user: "bg-gray-100 text-gray-800 border-gray-200",
  content_manager: "bg-purple-100 text-purple-800 border-purple-200",
  inventory_manager: "bg-amber-100 text-amber-800 border-amber-200",
  customer_support: "bg-green-100 text-green-800 border-green-200",
};

const AdminUsers = () => {
  const { toast } = useToast();
  const { isMaster } = useCmsAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("editor");
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    // Get all profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone");
    // Get all roles including is_master
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, is_master");

    if (!profiles) {
      setLoading(false);
      return;
    }

    const roleMap = new Map<string, AppRole[]>();
    const masterMap = new Map<string, Set<AppRole>>();
    (roles || []).forEach((r: any) => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
      if (r.is_master) {
        const masters = masterMap.get(r.user_id) || new Set();
        masters.add(r.role);
        masterMap.set(r.user_id, masters);
      }
    });

    const merged: UserWithRoles[] = profiles.map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      roles: roleMap.get(p.user_id) || [],
      masterRoles: masterMap.get(p.user_id) || new Set(),
    }));

    // Sort: master first, then users with roles, then alphabetically
    merged.sort((a, b) => {
      if (a.masterRoles.size > 0 && b.masterRoles.size === 0) return -1;
      if (b.masterRoles.size > 0 && a.masterRoles.size === 0) return 1;
      return b.roles.length - a.roles.length;
    });

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addRoleToUser = async () => {
    if (!selectedUserId.trim()) return;

    // Safety guard: only master admin can assign the 'admin' role
    if (addRole === "admin" && !isMaster) {
      toast({
        title: "Permission Denied",
        description: "Only the Master Administrator can grant full Admin privileges.",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedUserId.trim());
    let userId = selectedUserId.trim();

    if (!isUUID) {
      const { data: matches } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${selectedUserId.trim()}%`)
        .limit(1);

      if (!matches || matches.length === 0) {
        toast({
          title: "User not found",
          description: "No user found with that name. Please select a user from the table.",
          variant: "destructive",
        });
        setAdding(false);
        return;
      }
      userId = matches[0].user_id;
    }

    // Check if role already exists
    const existing = users.find((u) => u.user_id === userId);
    if (existing?.roles.includes(addRole)) {
      toast({
        title: "Role exists",
        description: `This user already has the ${addRole} role.`,
        variant: "destructive",
      });
      setAdding(false);
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: addRole as any, is_master: false });

    if (error) {
      toast({ title: "Error assigning role", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Role assigned",
        description: `${addRole.toUpperCase()} role assigned successfully.`,
      });
      setAddOpen(false);
      setSelectedUserId("");
      fetchUsers();
    }
    setAdding(false);
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const user = users.find((u) => u.user_id === userId);

    // Master roles can never be removed via standard interface
    if (user?.masterRoles.has(role)) {
      toast({
        title: "Protected Role",
        description: "This is a protected Master Administrator role and cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

    // Non-master admins cannot delete admin roles
    if (role === "admin" && !isMaster) {
      toast({
        title: "Permission Denied",
        description: "Only the Master Administrator can revoke Admin roles.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to remove the "${role}" role from this user?`)) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role removed", description: `Removed ${role} role successfully.` });
      fetchUsers();
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return u.roles.length > 0;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.user_id.toLowerCase().includes(q)
    );
  });

  const adminCount = users.filter((u) => u.roles.includes("admin")).length;
  const editorCount = users.filter((u) => u.roles.includes("editor") || u.roles.includes("content_manager")).length;
  const totalWithRoles = users.filter((u) => u.roles.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Role & Team Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assign and manage CMS access levels for administrators and content editors
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Assign New Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role to Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>User (Select or enter Name / UUID)</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a registered user..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || "Unnamed User"} ({u.user_id.slice(0, 8)}…)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <Input
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    placeholder="Or paste User UUID directly"
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Role to Assign</Label>
                <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.filter((r) => (isMaster ? true : r !== "admin")).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r === "admin"
                          ? "Administrator (Full System Access)"
                          : r === "editor"
                          ? "Editor (Content & Catalog Only)"
                          : r.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isMaster && (
                  <p className="text-xs text-muted-foreground mt-1">
                    * Only Master Admins can assign full Administrator privileges.
                  </p>
                )}
              </div>
              <Button onClick={addRoleToUser} disabled={adding || !selectedUserId} className="w-full">
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Role Assignment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Master & Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">{adminCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Content Editors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">{editorCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Team with Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalWithRoles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Customer Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <Input
          placeholder="Filter by name or User ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm mb-4"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Assigned Roles</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading team roles...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No team members found with assigned roles.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const hasMaster = u.masterRoles.size > 0;
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{u.full_name || "—"}</span>
                          {hasMaster && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-semibold flex items-center gap-1"
                            >
                              <Crown className="h-3 w-3 text-amber-600" /> Master Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {u.user_id.slice(0, 8)}…{u.user_id.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => {
                            const isThisMaster = u.masterRoles.has(r);
                            return (
                              <Badge
                                key={r}
                                variant="outline"
                                className={`text-xs ${roleBadgeColor[r] || "bg-gray-100"}`}
                              >
                                {r.replace(/_/g, " ")}
                                {isThisMaster ? (
                                  <Shield className="ml-1 h-3 w-3 text-amber-600" />
                                ) : (
                                  <button
                                    onClick={() => removeRole(u.user_id, r)}
                                    className="ml-1.5 hover:text-destructive text-muted-foreground"
                                    title="Revoke role"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUserId(u.user_id);
                            setAddOpen(true);
                          }}
                          title="Assign additional role"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
