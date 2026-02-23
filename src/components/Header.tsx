import { useState } from "react";
import { Search, ShoppingBag, User, Menu, X, ChevronDown } from "lucide-react";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Home", href: "#" },
  {
    label: "Shop",
    href: "#",
    children: [
      { label: "Powders", href: "#" },
      { label: "Capsules", href: "#" },
      { label: "Oils & Ghee", href: "#" },
      { label: "Seeds & Grains", href: "#" },
      { label: "Teas & Infusions", href: "#" },
      { label: "Starter Kits", href: "#" },
      { label: "Bundles", href: "#" },
    ],
  },
  {
    label: "Shop by Goal",
    href: "#",
    children: [
      { label: "Energy & Performance", href: "#" },
      { label: "Everyday Wellness", href: "#" },
      { label: "Detox & Cleanse", href: "#" },
      { label: "Mind-Body Balance", href: "#" },
      { label: "Gentle Reset", href: "#" },
      { label: "Conscious Gifting", href: "#" },
    ],
  },
  { label: "About", href: "#" },
  { label: "Learn", href: "#" },
  { label: "Community", href: "#" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      {/* Top announcement bar */}
      <div className="bg-primary text-primary-foreground text-center text-sm py-2 font-body">
        Free shipping on orders above ₹999 🌿 Use code <span className="font-semibold">LEAF20</span> for 20% off
      </div>

      <div className="container flex items-center justify-between h-16 md:h-20">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-foreground"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Logo */}
        <a href="#" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="Leaf & Kernel Superfoods" className="h-10 md:h-14 w-auto" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <div
              key={link.label}
              className="relative group"
              onMouseEnter={() => link.children && setOpenDropdown(link.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <a
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-foreground hover:text-secondary transition-colors flex items-center gap-1"
              >
                {link.label}
                {link.children && <ChevronDown size={14} className="opacity-60" />}
              </a>
              {link.children && openDropdown === link.label && (
                <div className="absolute top-full left-0 bg-background border border-border rounded-lg shadow-lg py-2 min-w-[200px] animate-fade-in-up">
                  {link.children.map((child) => (
                    <a
                      key={child.label}
                      href={child.href}
                      className="block px-4 py-2 text-sm text-foreground hover:bg-muted hover:text-secondary transition-colors"
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-foreground hover:text-secondary transition-colors" aria-label="Search">
            <Search size={20} />
          </button>
          <button className="p-2 text-foreground hover:text-secondary transition-colors" aria-label="Account">
            <User size={20} />
          </button>
          <button className="relative p-2 text-foreground hover:text-secondary transition-colors" aria-label="Cart">
            <ShoppingBag size={20} />
            <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              0
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-background border-t border-border px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <div key={link.label}>
              <a href={link.href} className="block py-2 text-foreground font-medium">
                {link.label}
              </a>
              {link.children && (
                <div className="pl-4 space-y-1">
                  {link.children.map((child) => (
                    <a key={child.label} href={child.href} className="block py-1.5 text-sm text-muted-foreground">
                      {child.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;
