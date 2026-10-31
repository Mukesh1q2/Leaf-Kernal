import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, HeartHandshake } from "lucide-react";

const commitments = [
  {
    icon: Sparkles,
    badge: "Botanical Sourcing",
    title: "Pure & Unadulterated",
    desc: "Single-origin superfood powders and handpicked jumbo lotus seeds. No fillers, no chemical binders, and no hidden preservatives.",
    highlight: "100% Plant Ingredients",
  },
  {
    icon: ShieldCheck,
    badge: "Quality Standards",
    title: "Rigorous FSSAI Compliance",
    desc: "Crafted in GMP-aligned certified facilities under strict food safety and hygiene protocols, with complete transparency in every batch.",
    highlight: "Lab-Tested Standards",
  },
  {
    icon: HeartHandshake,
    badge: "Ayurvedic Heritage",
    title: "Made for Daily Wellness",
    desc: "Rooted in classical Ayurvedic botanical principles and packaged in convenient formats designed for effortless modern daily nutrition.",
    highlight: "Clean Daily Nutrition",
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 md:py-24 bg-muted">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">Our Quality Commitment</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-2">
            The UVEDIQ Standard
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mt-2">
            Pure green goodness and authentic Ayurvedic superfoods, crafted with complete integrity for your everyday wellness.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {commitments.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-background rounded-xl p-6 border border-border relative flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-forest-light/60 flex items-center justify-center mb-4 text-secondary">
                  <c.icon size={24} />
                </div>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
                  {c.badge}
                </span>
                <h3 className="text-lg font-heading font-bold text-foreground mb-2">
                  {c.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {c.desc}
                </p>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between text-xs font-medium text-foreground/80">
                <span>Verification</span>
                <span className="text-secondary font-semibold">{c.highlight}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
