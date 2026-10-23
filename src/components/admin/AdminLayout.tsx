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
import {
  canAccessRoute,
  hasAnyCmsRole,
  getPrimaryRoleBadge,
} from "@/lib/cmsRoles";

export interface CmsAuthContextType {
  roles: string[];
  isAdmin: boolean;
  isEditor: boolean;
  isContentManager: boolean;
  isInventoryManager: boolean;
  isCustomerSupport: boolean;
  isModerator: boolean;
  isMaster: boolean;
}

const CmsAuthContext = createContext<CmsAuthContextType>({
  roles: [],
  isAdmin: false,
  isEditor: false,
  isContentManager: false,
  isInventoryManager: false,
  isCustomerSupport: false,
  isModerator: false,
  isMaster: false,
});

export const useCmsAuth = () => useContext(CmsAuthContext);

const AdminLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
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
          setUserRoles([]);
          setIsMaster(false);
          setCheckingRoles(false);
        }
        return;
      }

      if (checkSessionTimeout()) return;

      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role, is_master")
          .eq("user_id", user.id);

        const roleList = (roles || []).map((r) => r.role);
        const hasMasterFlag = (roles || []).some((r) => r.is_master);

        if (isMounted) {
          setUserRoles(roleList);
          setIsMaster(hasMasterFlag);
          setCheckingRoles(false);
        }
      } catch {
        if (isMounted) {
          setUserRoles([]);
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

  const hasAccess = hasAnyCmsRole(userRoles);
  const isAdmin = userRoles.includes("admin");
  const isEditor = userRoles.includes("editor") || userRoles.includes("content_manager");
  const isContentManager = userRoles.includes("content_manager");
  const isInventoryManager = userRoles.includes("inventory_manager");
  const isCustomerSupport = userRoles.includes("customer_support");
  const isModerator = userRoles.includes("moderator");

  // Handle route protection
  useEffect(() => {
    if (checkingRoles || authLoading) return;

    if (!hasAccess) {
      navigate("/admin/login", { replace: true });
      return;
    }

    // Granular route permission check
    const allowed = canAccessRoute(userRoles, location.pathname);
    if (!allowed) {
      toast({
        title: "Permission Denied",
        description: "Your role does not have permission to access this section.",
        variant: "destructive",
      });
      navigate("/admin", { replace: true });
    }
  }, [hasAccess, userRoles, checkingRoles, authLoading, location.pathname, navigate, toast]);

  if (authLoading || checkingRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verifying CMS access...</div>
      </div>
    );
  }

  if (!hasAccess) return null;

  const roleBadge = getPrimaryRoleBadge(userRoles, isMaster);

  return (
    <CmsAuthContext.Provider
      value={{
        roles: userRoles,
        isAdmin,
        isEditor,
        isContentManager,
        isInventoryManager,
        isCustomerSupport,
        isModerator,
        isMaster,
      }}
    >
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <main className="flex-1 overflow-auto">
            <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-40">
              <div className="flex items-center">
                <SidebarTrigger className="mr-4" />
                <h1 className="font-heading font-semibold text-foreground">
                  {isAdmin ? "Admin Dashboard" : `${roleBadge} Dashboard`}
                </h1>
              </div>
              <div className="text-xs px-2.5 py-1 rounded-full font-medium border bg-muted/60 text-muted-foreground">
                {roleBadge}
              </div>
            </header>
            <div className="p-6">
              <Outlet
                context={{
                  roles: userRoles,
                  isAdmin,
                  isEditor,
                  isContentManager,
                  isInventoryManager,
                  isCustomerSupport,
                  isModerator,
                  isMaster,
                }}
              />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </CmsAuthContext.Provider>
  );
};

export default AdminLayout;
