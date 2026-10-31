import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import HealthConcerns from "@/components/HealthConcerns";
import BestSellers from "@/components/BestSellers";
import StatsSection from "@/components/StatsSection";
import Testimonials from "@/components/Testimonials";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { TrendingProducts, RecommendedForYou } from "@/components/RecommendationWidgets";
import { SEOHead } from "@/components/SEOHead";
import { generateOrganizationSchema } from "@/lib/seo";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Plant-Powered Superfoods & Ayurvedic Wellness"
        description="Shop pure, plant-powered Ayurvedic superfoods, Ashwagandha capsules, Moringa, Wheatgrass & Jumbo Makhana. Free shipping on orders above ₹999."
        url="https://leafandkernel.com/"
        jsonLd={generateOrganizationSchema()}
      />
      <Header />
      <main>
        <HeroSection />
        <HealthConcerns />
        <BestSellers />
        <RecommendedForYou />
        <TrendingProducts />
        <StatsSection />
        <Testimonials />
        <Newsletter />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
