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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Users, Shield, UserPlus, Trash2, Loader2, Crown, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useCmsAuth } from "@/components/admin/AdminLayout";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleAssignment {
  id: string;
  role: AppRole;
  is_master: boolean;
}

interface UserWithRoles {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  roles: RoleAssignment[];
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
  admin: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40",
  editor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
  moderator: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40",
  user: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  content_manager: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
  inventory_manager: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
  customer_support: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/40",
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

  // In-app confirmation dialog for role removal
  const [pendingRevoke, setPendingRevoke] = useState<{
    userId: string;
    roleId?: string;
    role: AppRole;
    userName: string;
  } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get all profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone");
      // Get all roles including primary key id and is_master
      const { data: roles } = await supabase.from("user_roles").select("id, user_id, role, is_master");

      if (!profiles) {
        setLoading(false);
        return;
      }

      const roleMap = new Map<string, RoleAssignment[]>();
      const masterMap = new Map<string, Set<AppRole>>();

      (roles || []).forEach((r: any) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push({
          id: r.id,
          role: r.role,
          is_master: Boolean(r.is_master),
        });
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
    } catch (err: any) {
      toast({
        title: "Error loading team",
        description: err?.message || "Failed to load roles.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    if (existing?.roles.some((r) => r.role === addRole)) {
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
      await fetchUsers();
    }
    setAdding(false);
  };

  const handleRequestRevoke = (
    userId: string,
    roleAssignment: RoleAssignment,
    userName: string | null
  ) => {
    // Master roles can never be removed via standard interface
    if (roleAssignment.is_master) {
      toast({
        title: "Protected Role",
        description: "This is a protected Master Administrator role and cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

    // Non-master admins cannot delete admin roles
    if (roleAssignment.role === "admin" && !isMaster) {
      toast({
        title: "Permission Denied",
        description: "Only the Master Administrator can revoke Admin roles.",
        variant: "destructive",
      });
      return;
    }

    setPendingRevoke({
      userId,
      roleId: roleAssignment.id,
      role: roleAssignment.role,
      userName: userName || "this team member",
    });
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevoke) return;
    const { userId, roleId, role, userName } = pendingRevoke;
    setRevoking(true);

    try {
      // Execute role revocation via secure database RPC that enforces authorization
      // and atomically writes to admin_activity_log within the same transaction.
      const { data: rpcData, error: rpcError } = await supabase.rpc("remove_user_role", {
        p_user_id: userId,
        p_role: role,
      });

      if (rpcError) {
        toast({
          title: "Revocation Failed",
          description: rpcError.message || "Could not delete role.",
          variant: "destructive",
        });
        setRevoking(false);
        return;
      }

      const result = rpcData as { success?: boolean; message?: string } | null;
      if (result && result.success === false) {
        toast({
          title: "Revocation Rejected",
          description: result.message || "Operation could not be completed.",
          variant: "destructive",
        });
        setRevoking(false);
        return;
      }

      toast({
        title: "Role Revoked",
        description: `Successfully removed ${role.replace(/_/g, " ")} role from ${userName}.`,
      });
      setPendingRevoke(null);
      await fetchUsers();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "An unexpected error occurred while revoking role.",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
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

  const adminCount = users.filter((u) => u.roles.some((r) => r.role === "admin")).length;
  const editorCount = users.filter((u) => u.roles.some((r) => r.role === "editor" || r.role === "content_manager")).length;
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
              <DialogTitle>Assign Role to User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>User (Select from registered profiles or paste UUID)</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || "Unnamed"} ({u.user_id.slice(0, 8)}…)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <Input
                    placeholder="Or paste User UUID directly..."
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} disabled={r === "admin" && !isMaster}>
                        <span className="capitalize">{r.replace(/_/g, " ")}</span>
                        {r === "admin" && !isMaster && " (Master Admin Only)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addRole === "admin" && !isMaster && (
                  <p className="text-xs text-destructive mt-1">
                    Only the Master Administrator can grant full Admin privileges.
                  </p>
                )}
              </div>
              <Button onClick={addRoleToUser} disabled={adding || !selectedUserId} className="w-full">
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Assign Role
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> {totalWithRoles}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Administrators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" /> {adminCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content Editors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" /> {editorCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search team members by name or UUID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Users Table */}
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
                              className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-semibold flex items-center gap-1 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
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
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r) => {
                            const isThisMaster = r.is_master;
                            return (
                              <Badge
                                key={r.id || r.role}
                                variant="outline"
                                className={`text-xs pl-2 pr-1.5 py-0.5 inline-flex items-center gap-1 ${roleBadgeColor[r.role] || "bg-gray-100"}`}
                              >
                                <span className="capitalize">{r.role.replace(/_/g, " ")}</span>
                                {isThisMaster ? (
                                  <Shield className="h-3 w-3 text-amber-600 ml-0.5" title="Protected Master Role" />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRequestRevoke(u.user_id, r, u.full_name);
                                    }}
                                    className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-colors cursor-pointer inline-flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-destructive"
                                    title={`Revoke ${r.role} role`}
                                    aria-label={`Revoke ${r.role} role`}
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

      {/* Confirmation Modal for Role Revocation (Replaces browser window.confirm) */}
      <AlertDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => !open && !revoking && setPendingRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle className="font-heading">Revoke Role Assignment</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              <p>
                Are you sure you want to remove the{" "}
                <strong className="text-foreground capitalize">"{pendingRevoke?.role.replace(/_/g, " ")}"</strong> role from{" "}
                <strong className="text-foreground">{pendingRevoke?.userName}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                This action immediately revokes corresponding CMS permissions for this user account.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              disabled={revoking}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {revoking ? "Revoking..." : "Revoke Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
