import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, Shield, Flame, Moon, Sparkles, Brain, Leaf, Dumbbell, Apple } from "lucide-react";

const concerns = [
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

const HealthConcerns = () => {
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

        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
          {concerns.map((item, i) => {
            const MotionLink = motion(Link);
            return (
              <MotionLink
                key={item.label}
                to={`/shop?concern=${item.slug}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group flex flex-col items-center p-4 bg-background rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-full bg-leaf/10 flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                  <item.icon size={24} className="text-secondary group-hover:text-secondary-foreground" />
                </div>
                <span className="text-sm font-semibold text-foreground text-center">{item.label}</span>
                <span className="text-xs text-muted-foreground text-center mt-1">{item.desc}</span>
              </MotionLink>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HealthConcerns;
