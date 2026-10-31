import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Newsletter = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Please enter your email address.");
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from("newsletter_subscribers" as any)
        .insert({
          email: value,
          source: "website_footer",
        });

      if (insertError) {
        // Postgres unique violation code 23505 or duplicate key
        if (
          insertError.code === "23505" ||
          insertError.message?.toLowerCase().includes("duplicate") ||
          insertError.message?.toLowerCase().includes("unique")
        ) {
          toast.info("You're already subscribed to our newsletter! 🌿");
          setEmail("");
          return;
        }
        throw insertError;
      }

      toast.success("You're subscribed! Welcome to the Leaf & Kernel family 🌿");
      setEmail("");
    } catch (err: any) {
      toast.error(err?.message || "Subscription failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">Stay Connected</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-2 mb-4">
            Join the Leaf & Kernel Family
          </h2>
          <p className="text-muted-foreground mb-8">
            Get wellness tips, Ayurvedic recipes, early access to new products, and exclusive offers delivered to your inbox.
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <div className="flex-1 text-left">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                className={`w-full px-4 py-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${error ? "border-destructive focus:ring-destructive/40" : "border-border focus:ring-secondary/50"}`}
              />
              {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Subscribing...
                </>
              ) : (
                <>
                  Subscribe <Send size={16} />
                </>
              )}
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">No spam, unsubscribe anytime. 🌿</p>
        </motion.div>
      </div>
    </section>
  );
};

export default Newsletter;
