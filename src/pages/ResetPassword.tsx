import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      toast.error("Invalid reset link");
      navigate("/auth");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else { toast.success("Password updated!"); navigate("/"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-16 max-w-md mx-auto">
        <h1 className="text-3xl font-heading font-bold text-foreground text-center mb-4">Set New Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" minLength={6} className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50" required />
          <button type="submit" disabled={loading} className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
