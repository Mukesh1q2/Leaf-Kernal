import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Priya Sharma",
    city: "Mumbai",
    product: "Ashwagandha Root Powder",
    text: "I've been using this for 3 months and my stress levels have dropped significantly. Sleep quality improved within the first week!",
    rating: 5,
  },
  {
    name: "Arjun Mehta",
    city: "Bangalore",
    product: "Moringa Leaf Powder",
    text: "Incredible energy boost without the jitters. I add it to my morning smoothie and feel the difference all day long.",
    rating: 5,
  },
  {
    name: "Sneha Patel",
    city: "Delhi",
    product: "Golden Turmeric Capsules",
    text: "My joint pain has reduced remarkably. The quality is outstanding – you can tell these are genuinely pure ingredients.",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 md:py-24 bg-muted">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">Real Stories</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-2">
            What Our Community Says
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-background rounded-xl p-6 border border-border relative"
            >
              <Quote size={32} className="text-leaf/20 absolute top-4 right-4" />
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={16} className="fill-gold text-gold" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-4 text-sm">"{t.text}"</p>
              <div className="border-t border-border pt-4">
                <p className="font-heading font-semibold text-foreground text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.city} · {t.product}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
