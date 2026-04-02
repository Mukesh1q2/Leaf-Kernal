import { Link } from "react-router-dom";
import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";

const footerLinks = {
  Shop: [
    { label: "Powders", to: "/shop?category=powders" },
    { label: "Capsules", to: "/shop?category=capsules" },
    { label: "Oils & Ghee", to: "/shop?category=oils-ghee" },
    { label: "Seeds & Grains", to: "/shop?category=seeds-grains" },
    { label: "Teas & Infusions", to: "/shop?category=teas-infusions" },
    { label: "Bundles", to: "/shop?category=bundles" },
  ],
  "Health Concerns": [
    { label: "Gut Care", to: "/shop?concern=gut-care" },
    { label: "Immunity", to: "/shop?concern=immunity" },
    { label: "Heart Care", to: "/shop?concern=heart-care" },
    { label: "Joint Care", to: "/shop?concern=joint-care" },
    { label: "Sleep Care", to: "/shop?concern=sleep-care" },
    { label: "Skin & Hair", to: "/shop?concern=skin-hair" },
  ],
  Company: [
    { label: "About Us", to: "/about" },
    { label: "Blog", to: "/blog" },
    { label: "Contact", to: "/contact" },
    { label: "FAQs", to: "/faq" },
  ],
  Support: [
    { label: "FAQs", to: "/faq" },
    { label: "Contact Us", to: "/contact" },
    { label: "My Account", to: "/account" },
    { label: "Track Order", to: "/account" },
  ],
};

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
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

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-heading text-sm font-semibold mb-4 opacity-90">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-forest-light flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm opacity-60">© 2026 Leaf & Kernel Superfoods Co. All rights reserved. | Design by <a href="https://theqbitlabs.com" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100 transition-opacity">The Qbitlabs</a></p>
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
