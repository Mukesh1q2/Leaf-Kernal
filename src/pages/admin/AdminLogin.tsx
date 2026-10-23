import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Loader2 } from "lucide-react";
import { hasAnyCmsRole } from "@/lib/cmsRoles";

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkCmsPrivileges = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Query user_roles directly for all assigned roles
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error || !roles) {
        // Fallback to has_cms_access RPC if direct query fails
        const { data: hasAccess } = await supabase.rpc("has_cms_access", {
          _user_id: userId,
        });
        return !!hasAccess;
      }

      const roleList = roles.map((r) => r.role);
      return hasAnyCmsRole(roleList);
    } catch {
      return false;
    }
  }, []);

  // Check if returning from Google OAuth or active session
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (isMounted) setCheckingAuth(false);
        return;
      }

      const hasAccess = await checkCmsPrivileges(session.user.id);

      if (!isMounted) return;

      if (hasAccess) {
        localStorage.setItem("admin_session_start", Date.now().toString());
        navigate("/admin", { replace: true });
      } else {
        // Authenticated user lacks CMS roles
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description: "Your account does not have CMS administrator or editor privileges.",
          variant: "destructive",
        });
        setCheckingAuth(false);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [checkCmsPrivileges, navigate, toast]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const hasAccess = await checkCmsPrivileges(data.user.id);

    if (!hasAccess) {
      await supabase.auth.signOut();
      toast({
        title: "Access denied",
        description: "You do not have CMS administrator or editor privileges.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    localStorage.setItem("admin_session_start", Date.now().toString());
    toast({ title: "Welcome back!" });
    navigate("/admin");
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/admin/login`,
      },
    });

    if (error) {
      toast({ title: "Google Sign-In failed", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying CMS authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex items-center gap-2">
            <Leaf className="h-8 w-8 text-primary" />
            <span className="text-2xl font-heading font-bold text-foreground">LeafKernel</span>
          </div>
          <p className="text-sm text-muted-foreground">Admin & Editor CMS Login</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full py-5 text-sm font-medium flex items-center justify-center gap-2 border-border hover:bg-muted/60"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or sign in with password</span>
            </div>
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@leafandkernel.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
export { SESSION_TIMEOUT_MS };
