import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Leaf, Heart, Award, Globe } from "lucide-react";

const values = [
  { icon: Leaf, title: "Rooted in Ayurveda", desc: "Every product is formulated using time-tested Ayurvedic principles, bringing ancient wisdom to modern wellness." },
  { icon: Heart, title: "Plant-Powered Purity", desc: "100% plant-based, no fillers, no artificial additives. Just the purest superfoods nature has to offer." },
  { icon: Award, title: "Certified Organic", desc: "All our products are FSSAI licensed and certified organic, ensuring the highest standards of quality and safety." },
  { icon: Globe, title: "Sustainably Sourced", desc: "We partner with sustainable farms across India, supporting local communities and protecting the environment." },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <div className="bg-primary py-16 text-center">
          <h1 className="text-3xl md:text-5xl font-heading font-bold text-primary-foreground">Our Story</h1>
          <p className="text-primary-foreground/70 mt-3 max-w-lg mx-auto">Rooted in tradition, growing towards a healthier tomorrow</p>
        </div>

        <section className="container py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-6">From Seed to Superfood</h2>
            <div className="prose text-foreground leading-relaxed space-y-4">
              <p>Leaf & Kernel was born from a simple belief: that the ancient wisdom of Ayurveda holds the key to modern wellness. We saw a gap between the superfoods our grandmothers swore by and the fast-paced lives we lead today.</p>
              <p>Our journey began in the verdant farms of South India, where we discovered the incredible potential of moringa, turmeric, ashwagandha, and dozens of other powerful plants. We partnered with organic farmers who share our passion for purity and sustainability.</p>
              <p>Every Leaf & Kernel product is a bridge between tradition and innovation — carefully formulated, rigorously tested, and lovingly crafted to bring you the very best of plant-based nutrition.</p>
              <p>Today, we serve over 25,000 happy customers across India, and our mission remains the same: to make Ayurvedic superfoods accessible, affordable, and part of everyone's daily wellness routine.</p>
            </div>
          </div>
        </section>

        <section className="bg-muted py-16">
          <div className="container">
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground text-center mb-12">Our Values</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map(v => (
                <div key={v.title} className="bg-background rounded-xl p-6 border border-border text-center">
                  <v.icon size={32} className="text-secondary mx-auto mb-4" />
                  <h3 className="font-heading font-semibold text-foreground mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
