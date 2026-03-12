import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import HealthConcerns from "@/components/HealthConcerns";
import BestSellers from "@/components/BestSellers";
import StatsSection from "@/components/StatsSection";
import Testimonials from "@/components/Testimonials";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <HealthConcerns />
        <BestSellers />
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
