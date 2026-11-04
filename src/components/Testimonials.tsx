import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Quote, CheckCircle2, MessageSquareHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TestimonialItem {
  id: string;
  name: string;
  city: string | null;
  product: string | null;
  quote: string;
  rating: number;
  photo_url: string | null;
  sort_order: number;
}

export const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("testimonials")
          .select("*")
          .eq("is_active", true)
          .order("sort_order");

        if (error) {
          console.warn("Could not load testimonials:", error.message);
        } else if (mounted) {
          setTestimonials(data || []);
        }
      } catch (err) {
        console.warn("Error loading testimonials:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="py-16 md:py-24 bg-background">
        <div className="container text-center">
          <div className="animate-pulse space-y-4 max-w-md mx-auto">
            <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
            <div className="h-8 bg-muted rounded w-2/3 mx-auto" />
          </div>
        </div>
      </section>
    );
  }

  // If no testimonials in database yet, gracefully show a friendly community invitation or return null
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-background border-t border-border">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest flex items-center justify-center gap-1.5">
            <MessageSquareHeart size={16} /> Verified Customer Stories
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-2">
            Real Experiences, Real Wellness
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mt-2">
            Read authentic feedback from everyday people who have made Leaf &amp; Kernel superfoods part of their daily routine.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative"
            >
              <div>
                {/* Rating stars & Quote Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1" aria-label={`${t.rating} out of 5 stars`}>
                    {[...Array(t.rating || 5)].map((_, starIdx) => (
                      <Star key={starIdx} size={15} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Quote className="h-6 w-6 text-muted-foreground/30" />
                </div>

                {/* Quote text */}
                <p className="text-foreground/90 text-sm leading-relaxed mb-6 italic">
                  "{t.quote}"
                </p>
              </div>

              {/* Customer details */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {t.photo_url ? (
                    <img
                      src={t.photo_url}
                      alt={t.name}
                      className="w-10 h-10 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary font-semibold flex items-center justify-center text-sm">
                      {t.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-sm text-foreground">{t.name}</p>
                      <CheckCircle2 size={13} className="text-secondary" title="Verified Customer" />
                    </div>
                    {t.city && (
                      <p className="text-xs text-muted-foreground">{t.city}</p>
                    )}
                  </div>
                </div>

                {t.product && (
                  <span className="text-[11px] font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full max-w-[120px] truncate">
                    {t.product}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
