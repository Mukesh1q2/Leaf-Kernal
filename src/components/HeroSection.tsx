import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import heroImg from "@/assets/hero-superfoods.jpg";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HeroBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  bg_color: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

const HeroSection = () => {
  const { settings } = useStoreSettings();
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("banners")
          .select("*")
          .eq("position", "hero")
          .eq("is_active", true)
          .order("sort_order");

        if (error || !data) return;

        const now = new Date();
        const valid = data.filter((b) => {
          if (b.starts_at && new Date(b.starts_at) > now) return false;
          if (b.ends_at && new Date(b.ends_at) < now) return false;
          return true;
        });

        if (mounted) {
          setHeroBanners(valid);
        }
      } catch (err) {
        console.warn("Could not load hero banners:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-advance if multiple hero banners
  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroBanners.length]);

  // If CMS hero banner is configured, render it
  if (heroBanners.length > 0) {
    const banner = heroBanners[currentIndex];
    const bgImage = banner.image_url || heroImg;

    return (
      <section className="relative overflow-hidden min-h-[500px] max-h-[85vh] flex items-center bg-primary">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <img src={bgImage} alt={banner.title} className="w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: banner.bg_color || "#1A4D2E",
                opacity: 0.75,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        <div className="container relative z-10 py-16 md:py-20 lg:py-24">
          <motion.div
            key={`content-${banner.id}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-xl text-white"
          >
            <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm border border-white/30">
              🌿 Featured Wellness Promotion
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-tight mb-6 drop-shadow-sm">
              {banner.title}
            </h1>
            {banner.subtitle && (
              <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-8 max-w-md drop-shadow-sm">
                {banner.subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              <Link
                to={banner.cta_link || "/shop"}
                className="inline-flex items-center px-8 py-3.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-leaf transition-colors shadow-lg"
              >
                {banner.cta_text || "Shop Now"}
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

        {heroBanners.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length)}
              className="text-white hover:text-secondary p-1"
              aria-label="Previous banner"
            >
              <ChevronLeft size={16} />
            </button>
            {heroBanners.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all ${idx === currentIndex ? "w-6 bg-secondary" : "w-2 bg-white/50"}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % heroBanners.length)}
              className="text-white hover:text-secondary p-1"
              aria-label="Next banner"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
    );
  }

  // Fallback: Default Brand Hero (with editable copy from Store Settings)
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
            {settings.hero_headline}
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-8 max-w-md">
            {settings.hero_subtitle}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to={settings.hero_cta_link || "/shop"}
              className="inline-flex items-center px-8 py-3.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-leaf transition-colors shadow-lg"
            >
              {settings.hero_cta_text || "Shop Superfoods"}
            </Link>
            <Link
              to="/bundles"
              className="inline-flex items-center px-8 py-3.5 bg-primary-foreground/10 text-primary-foreground font-semibold rounded-lg hover:bg-primary-foreground/20 transition-colors backdrop-blur-sm border border-primary-foreground/20"
            >
              Combos &amp; Bundles
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
