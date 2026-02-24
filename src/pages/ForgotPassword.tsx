import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else { setSent(true); toast.success("Password reset email sent!"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-16 max-w-md mx-auto">
        <h1 className="text-3xl font-heading font-bold text-foreground text-center mb-4">Reset Password</h1>
        {sent ? (
          <p className="text-center text-muted-foreground">Check your email for the reset link.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50" required />
            <button type="submit" disabled={loading} className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-50">
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ForgotPassword;
