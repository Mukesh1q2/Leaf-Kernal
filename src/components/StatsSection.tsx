import { motion } from "framer-motion";
import { Leaf, Users, Award, Truck } from "lucide-react";

const stats = [
  { icon: Leaf, value: "50+", label: "Superfoods", desc: "Pure plant-based formulations" },
  { icon: Users, value: "25K+", label: "Happy Customers", desc: "Across India & beyond" },
  { icon: Award, value: "100%", label: "Natural Ingredients", desc: "No fillers or additives" },
  { icon: Truck, value: "500+", label: "Cities Delivered", desc: "Fast & free shipping" },
];

const StatsSection = () => {
  return (
    <section className="bg-primary py-16 md:py-20">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-full bg-forest-light mx-auto mb-4 flex items-center justify-center">
                <stat.icon size={24} className="text-leaf-light" />
              </div>
              <div className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">{stat.value}</div>
              <div className="text-sm font-semibold text-leaf-light mt-1">{stat.label}</div>
              <div className="text-xs text-primary-foreground/60 mt-1">{stat.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
