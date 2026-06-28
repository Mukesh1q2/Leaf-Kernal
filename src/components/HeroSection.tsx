import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroImg from "@/assets/hero-superfoods.jpg";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden max-h-[85vh] flex items-center">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Ayurvedic superfoods flat lay" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/85 via-primary/60 to-transparent" />
      </div>

      <div className="container relative z-10 py-16 md:py-20 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-xl"
        >
          <span className="inline-block bg-secondary/20 text-leaf-light text-sm font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm border border-leaf-light/20">
            🌿 Ayurveda meets modern wellness
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-primary-foreground leading-tight mb-6">
            Plant-powered superfoods for{" "}
            <span className="text-leaf-light italic">modern life</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-8 max-w-md">
            Rooted in ancient Ayurvedic wisdom, crafted with care for your everyday wellness journey.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/shop"
              className="inline-flex items-center px-8 py-3.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-leaf transition-colors shadow-lg"
            >
              Shop Superfoods
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center px-8 py-3.5 bg-primary-foreground/10 text-primary-foreground font-semibold rounded-lg hover:bg-primary-foreground/20 transition-colors backdrop-blur-sm border border-primary-foreground/20"
            >
              Shop by Goal
            </Link>
            <Link
              to="/quiz"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold text-primary font-semibold rounded-lg hover:bg-gold-light transition-colors shadow-lg"
            >
              ✨ Take the 60s Quiz
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
