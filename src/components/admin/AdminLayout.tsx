import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import { SESSION_TIMEOUT_MS } from "@/pages/admin/AdminLogin";
import { useToast } from "@/hooks/use-toast";

interface CmsAuthContextType {
  isAdmin: boolean;
  isEditor: boolean;
  isMaster: boolean;
}

const CmsAuthContext = createContext<CmsAuthContextType>({
  isAdmin: false,
  isEditor: false,
  isMaster: false,
});

export const useCmsAuth = () => useContext(CmsAuthContext);

// Routes restricted strictly to full administrators (editors cannot access)
const ADMIN_ONLY_ROUTES = [
  "/admin/users",
  "/admin/orders",
  "/admin/customers",
  "/admin/deliveries",
  "/admin/subscriptions",
  "/admin/coupons",
  "/admin/settings",
  "/admin/inquiries",
  "/admin/abandoned-carts",
  "/admin/analytics",
  "/admin/loyalty",
  "/admin/referrals",
];

const AdminLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [checkingRoles, setCheckingRoles] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const checkSessionTimeout = useCallback(() => {
    const start = localStorage.getItem("admin_session_start");
    if (start && Date.now() - parseInt(start, 10) > SESSION_TIMEOUT_MS) {
      localStorage.removeItem("admin_session_start");
      supabase.auth.signOut();
      navigate("/admin/login", { replace: true });
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(checkSessionTimeout, 60_000);
    return () => clearInterval(interval);
  }, [checkSessionTimeout]);

  useEffect(() => {
    let isMounted = true;

    const checkRoles = async () => {
      if (!user) {
        if (isMounted) {
          setIsAdmin(false);
          setIsEditor(false);
          setIsMaster(false);
          setCheckingRoles(false);
        }
        return;
      }

      if (checkSessionTimeout()) return;

      try {
        // Query user roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role, is_master")
          .eq("user_id", user.id);

        const roleList = (roles || []).map((r) => r.role);
        const hasAdminRole = roleList.includes("admin");
        const hasEditorRole = roleList.includes("editor") || roleList.includes("content_manager");
        const hasMasterFlag = (roles || []).some((r) => r.is_master);

        if (isMounted) {
          setIsAdmin(hasAdminRole);
          setIsEditor(hasEditorRole);
          setIsMaster(hasMasterFlag);
          setCheckingRoles(false);
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
          setIsEditor(false);
          setIsMaster(false);
          setCheckingRoles(false);
        }
      }
    };

    if (!authLoading) {
      checkRoles();
    }

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, checkSessionTimeout]);

  // Handle route protection
  useEffect(() => {
    if (checkingRoles || authLoading) return;

    const hasAccess = isAdmin || isEditor;
    if (!hasAccess) {
      navigate("/admin/login", { replace: true });
      return;
    }

    // If editor (not admin) attempts to access admin-only route
    if (isEditor && !isAdmin) {
      const isRestricted = ADMIN_ONLY_ROUTES.some((route) =>
        location.pathname.startsWith(route)
      );
      if (isRestricted) {
        toast({
          title: "Permission Denied",
          description: "This section is restricted to full administrators.",
          variant: "destructive",
        });
        navigate("/admin", { replace: true });
      }
    }
  }, [isAdmin, isEditor, checkingRoles, authLoading, location.pathname, navigate, toast]);

  if (authLoading || checkingRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verifying CMS access...</div>
      </div>
    );
  }

  if (!isAdmin && !isEditor) return null;

  return (
    <CmsAuthContext.Provider value={{ isAdmin, isEditor, isMaster }}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <main className="flex-1 overflow-auto">
            <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-40">
              <div className="flex items-center">
                <SidebarTrigger className="mr-4" />
                <h1 className="font-heading font-semibold text-foreground">
                  {isAdmin ? "Admin Dashboard" : "Content Editor Dashboard"}
                </h1>
              </div>
              <div className="text-xs px-2.5 py-1 rounded-full font-medium border bg-muted/60 text-muted-foreground">
                {isMaster ? "Master Admin" : isAdmin ? "Administrator" : "Editor"}
              </div>
            </header>
            <div className="p-6">
              <Outlet context={{ isAdmin, isEditor, isMaster }} />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </CmsAuthContext.Provider>
  );
};

export default AdminLayout;
