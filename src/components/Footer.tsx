import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const { settings } = useStoreSettings();
  const [categories, setCategories] = useState<{ label: string; to: string }[]>([]);
  const [concerns, setConcerns] = useState<{ label: string; to: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: cats }, { data: cons }] = await Promise.all([
          supabase.from("categories").select("name,slug").order("sort_order").limit(6),
          supabase.from("health_concerns").select("name,slug").order("sort_order").limit(6),
        ]);

        if (mounted) {
          if (cats && cats.length > 0) {
            setCategories(cats.map((c) => ({ label: c.name, to: `/shop?category=${c.slug}` })));
          }
          if (cons && cons.length > 0) {
            setConcerns(cons.map((c) => ({ label: c.name, to: `/shop?concern=${c.slug}` })));
          }
        }
      } catch (err) {
        console.warn("Could not load dynamic footer links:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const socials = [
    { Icon: Instagram, url: settings.instagram_url, label: "Instagram" },
    { Icon: Facebook, url: settings.facebook_url, label: "Facebook" },
    { Icon: Twitter, url: settings.twitter_url, label: "Twitter" },
    { Icon: Youtube, url: settings.youtube_url, label: "YouTube" },
  ];

  const defaultCategoryLinks = [
    { label: "Powders", to: "/shop?category=powders" },
    { label: "Capsules", to: "/shop?category=capsules" },
    { label: "Oils & Ghee", to: "/shop?category=oils-ghee" },
    { label: "Seeds & Grains", to: "/shop?category=seeds-grains" },
    { label: "Teas & Infusions", to: "/shop?category=teas-infusions" },
  ];

  const defaultConcernLinks = [
    { label: "Gut Care", to: "/shop?concern=gut-care" },
    { label: "Immunity", to: "/shop?concern=immunity" },
    { label: "Heart Care", to: "/shop?concern=heart-care" },
    { label: "Joint Care", to: "/shop?concern=joint-care" },
    { label: "Sleep Care", to: "/shop?concern=sleep-care" },
    { label: "Skin & Hair", to: "/shop?concern=skin-hair" },
  ];

  const shopLinks = [
    ...(categories.length > 0 ? categories : defaultCategoryLinks),
    { label: "Bundles & Combos", to: "/bundles" },
  ];

  const healthConcernLinks = concerns.length > 0 ? concerns : defaultConcernLinks;

  const companyLinks = [
    { label: "About Us", to: "/about" },
    { label: "Blog", to: "/blog" },
    { label: "Contact Us", to: "/contact" },
    { label: "FAQs", to: "/faq" },
    { label: "Wellness Quiz", to: "/quiz" },
  ];

  const supportLinks = [
    { label: "FAQs", to: "/faq" },
    { label: "Contact Customer Care", to: "/contact" },
    { label: "My Account", to: "/account" },
    { label: "Track Order", to: "/track" },
    { label: "Shipping Policy", to: "/shipping-policy" },
    { label: "Return & Refund", to: "/return-policy" },
    { label: "Terms & Conditions", to: "/terms-conditions" },
  ];

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <img src={logoWhite} alt={settings.store_name} className="h-16 w-auto" />
            </div>
            <p className="text-sm opacity-80 leading-relaxed mb-3">
              UVEDIQ — plant-powered superfoods rooted in Ayurveda, crafted for modern life by {settings.store_name}.
            </p>
            <div className="text-xs opacity-70 leading-relaxed mb-6 space-y-1">
              <p><strong>Reg. Office:</strong> {settings.business_address}</p>
              <p>
                <strong>GSTIN:</strong> {settings.gstin} · <strong>FSSAI:</strong> {settings.fssai_number}
              </p>
            </div>
            <div className="flex gap-3">
              {socials.map(({ Icon, url, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-forest-light flex items-center justify-center hover:bg-secondary transition-colors"
                  aria-label={label}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold mb-4 opacity-90">Shop Catalog</h4>
            <ul className="space-y-2.5">
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold mb-4 opacity-90">Health Concerns</h4>
            <ul className="space-y-2.5">
              {healthConcernLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold mb-4 opacity-90">Company</h4>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold mb-4 opacity-90">Customer Support</h4>
            <ul className="space-y-2.5">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-forest-light flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="text-sm opacity-60 whitespace-normal break-words">
            © {new Date().getFullYear()} UVEDIQ · {settings.store_name}. All rights reserved. | Design by{" "}
            <a href="https://theqbitlabs.com" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100 transition-opacity whitespace-nowrap">
              The Qbitlabs
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm opacity-60">
            <span>FSSAI Lic. #{settings.fssai_number}</span>
            <span>•</span>
            <span>GSTIN: {settings.gstin}</span>
            <span>•</span>
            <span>100% Pure &amp; Plant-Based</span>
            <span>•</span>
            <span>Made in India 🇮🇳</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
