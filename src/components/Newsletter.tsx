import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

const Newsletter = () => {
  const [email, setEmail] = useState("");

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
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors"
            >
              Subscribe
              <Send size={16} />
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">No spam, unsubscribe anytime. 🌿</p>
        </motion.div>
      </div>
    </section>
  );
};

export default Newsletter;
