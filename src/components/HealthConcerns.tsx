import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, Shield, Flame, Moon, Sparkles, Brain, Leaf, Dumbbell, Apple, LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HealthConcernItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

const DEFAULT_CONCERNS = [
  { icon: Apple, label: "Gut Care", desc: "Digestive harmony", slug: "gut-care" },
  { icon: Shield, label: "Immunity", desc: "Natural defense", slug: "immunity" },
  { icon: Heart, label: "Heart Care", desc: "Cardiovascular health", slug: "heart-care" },
  { icon: Dumbbell, label: "Joint Care", desc: "Flexible movement", slug: "joint-care" },
  { icon: Moon, label: "Sleep Care", desc: "Restful nights", slug: "sleep-care" },
  { icon: Sparkles, label: "Skin & Hair", desc: "Radiant glow", slug: "skin-hair" },
  { icon: Flame, label: "Metabolism", desc: "Weight balance", slug: "metabolism" },
  { icon: Brain, label: "Mind & Focus", desc: "Mental clarity", slug: "mind-focus" },
  { icon: Leaf, label: "Nutrition", desc: "Daily nourishment", slug: "nutrition" },
];

const ICON_MAP: Record<string, LucideIcon> = {
  "gut-care": Apple,
  "immunity": Shield,
  "heart-care": Heart,
  "joint-care": Dumbbell,
  "sleep-care": Moon,
  "skin-hair": Sparkles,
  "metabolism": Flame,
  "mind-focus": Brain,
  "nutrition": Leaf,
  "energy": Flame,
  "stress-relief": Moon,
};

const HealthConcerns = () => {
  const [concerns, setConcerns] = useState<HealthConcernItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("health_concerns")
          .select("*")
          .order("sort_order");

        if (error) {
          console.warn("Could not load health concerns from CMS, using defaults:", error.message);
        } else if (mounted && data && data.length > 0) {
          setConcerns(data);
        }
      } catch (err) {
        console.warn("Error loading health concerns:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const itemsToRender = concerns.length > 0
    ? concerns.map((c) => {
        const IconComponent = ICON_MAP[c.slug] || Leaf;
        return {
          id: c.id,
          label: c.name,
          desc: c.description || "Holistic wellness",
          slug: c.slug,
          iconComponent: IconComponent,
          iconEmoji: c.icon && c.icon.length <= 4 ? c.icon : null,
        };
      })
    : DEFAULT_CONCERNS.map((d) => ({
        id: d.slug,
        label: d.label,
        desc: d.desc,
        slug: d.slug,
        iconComponent: d.icon,
        iconEmoji: null,
      }));

  return (
    <section id="concerns" className="py-16 md:py-24 bg-muted">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">Targeted Wellness</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-2">
            Shop by Health Concern
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            Find the right superfoods tailored to your unique health goals.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
          {itemsToRender.map((item, i) => {
            const MotionLink = motion(Link);
            return (
              <MotionLink
                key={item.slug}
                to={`/shop?concern=${item.slug}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="group flex flex-col items-center p-4 bg-background rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-leaf/10 flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors text-xl">
                  {item.iconEmoji ? (
                    <span>{item.iconEmoji}</span>
                  ) : (
                    <item.iconComponent size={24} className="text-secondary group-hover:text-secondary-foreground" />
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground text-center line-clamp-1">{item.label}</span>
                <span className="text-xs text-muted-foreground text-center mt-1 line-clamp-2">{item.desc}</span>
              </MotionLink>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HealthConcerns;
