import { Leaf, Instagram, Facebook, Twitter, Youtube } from "lucide-react";

const footerLinks = {
  Shop: ["Powders", "Capsules", "Oils & Ghee", "Seeds & Grains", "Teas & Infusions", "Bundles"],
  "Health Concerns": ["Gut Care", "Immunity", "Heart Care", "Joint Care", "Sleep Care", "Skin & Hair"],
  Company: ["About Us", "Our Story", "Sourcing", "Certifications", "Careers", "Contact"],
  Support: ["FAQs", "Shipping Policy", "Refund Policy", "Privacy Policy", "Terms of Service"],
};

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Leaf size={28} className="text-leaf-light" />
              <span className="font-heading text-xl font-semibold">Leaf & Kernel</span>
            </div>
            <p className="text-sm opacity-80 leading-relaxed mb-6">
              Plant-powered superfoods rooted in Ayurveda, crafted for modern life.
            </p>
            <div className="flex gap-3">
              {[Instagram, Facebook, Twitter, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-full bg-forest-light flex items-center justify-center hover:bg-secondary transition-colors"
                  aria-label="Social media"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-heading text-sm font-semibold mb-4 opacity-90">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-forest-light flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm opacity-60">© 2026 Leaf & Kernel Superfoods Co. All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm opacity-60">
            <span>FSSAI Licensed</span>
            <span>•</span>
            <span>100% Organic Certified</span>
            <span>•</span>
            <span>Made in India 🇮🇳</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
