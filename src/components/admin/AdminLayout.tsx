import { useEffect, useState, useCallback } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import { SESSION_TIMEOUT_MS } from "@/pages/admin/AdminLogin";

const AdminLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const checkSessionTimeout = useCallback(() => {
    const start = localStorage.getItem("admin_session_start");
    if (start && Date.now() - parseInt(start) > SESSION_TIMEOUT_MS) {
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
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      if (checkSessionTimeout()) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(!!data);
    };
    if (!authLoading) checkAdmin();
  }, [user, authLoading, checkSessionTimeout]);

  useEffect(() => {
    if (isAdmin === false) navigate("/admin/login", { replace: true });
  }, [isAdmin, navigate]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">
          <header className="h-14 border-b border-border flex items-center px-4 bg-background sticky top-0 z-40">
            <SidebarTrigger className="mr-4" />
            <h1 className="font-heading font-semibold text-foreground">Admin Dashboard</h1>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
