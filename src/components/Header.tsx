import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag, User, Menu, X, ChevronDown, Shield, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import SearchDialog from "@/components/SearchDialog";
import NotificationBell from "@/components/NotificationBell";
import { useLoyaltyBalance } from "@/lib/loyalty";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Home", href: "/" },
  {
    label: "Shop",
    href: "/shop",
    children: [
      { label: "Powders", href: "/shop?category=powders" },
      { label: "Capsules", href: "/shop?category=capsules" },
      { label: "Oils & Ghee", href: "/shop?category=oils-ghee" },
      { label: "Seeds & Grains", href: "/shop?category=seeds-grains" },
      { label: "Teas & Infusions", href: "/shop?category=teas-infusions" },
      { label: "Bundles", href: "/shop?category=bundles" },
    ],
  },
  {
    label: "Shop by Goal",
    href: "/shop",
    children: [
      { label: "Energy & Performance", href: "/shop?concern=metabolism" },
      { label: "Everyday Wellness", href: "/shop?concern=nutrition-support" },
      { label: "Detox & Cleanse", href: "/shop?concern=gut-care" },
      { label: "Mind-Body Balance", href: "/shop?concern=mind-focus" },
      { label: "Better Sleep", href: "/shop?concern=sleep-care" },
    ],
  },
  { label: "About", href: "/about" },
  { label: "Quiz", href: "/quiz" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { balance: loyaltyBalance } = useLoyaltyBalance();

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Check admin role
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="bg-primary text-primary-foreground text-center text-sm py-2 font-body">
          Free shipping on orders above ₹999 🌿 Use code <span className="font-semibold">LEAF20</span> for 20% off
        </div>

        <div className="container flex items-center justify-between h-16 md:h-20">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-foreground" aria-label="Toggle menu">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Leaf & Kernel Superfoods" className="h-10 md:h-14 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="relative group" onMouseEnter={() => link.children && setOpenDropdown(link.label)} onMouseLeave={() => setOpenDropdown(null)}>
                <Link to={link.href} className="px-3 py-2 text-sm font-medium text-foreground hover:text-secondary transition-colors flex items-center gap-1">
                  {link.label}
                  {link.children && <ChevronDown size={14} className="opacity-60" />}
                </Link>
                {link.children && openDropdown === link.label && (
                  <div className="absolute top-full left-0 bg-background border border-border rounded-lg shadow-lg py-2 min-w-[200px] animate-fade-in-up">
                    {link.children.map((child) => (
                      <Link key={child.label} to={child.href} className="block px-4 py-2 text-sm text-foreground hover:bg-muted hover:text-secondary transition-colors">
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(true)} className="p-2 text-foreground hover:text-secondary transition-colors" aria-label="Search (⌘K)">
              <Search size={20} />
            </button>
            <NotificationBell />
            {user && loyaltyBalance > 0 && (
              <Link to="/loyalty" className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-colors text-xs font-semibold text-secondary" title="Loyalty points">
                <Sparkles size={12} />
                {loyaltyBalance}
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="p-2 text-secondary hover:text-primary transition-colors" aria-label="Admin" title="Admin Dashboard">
                <Shield size={20} />
              </Link>
            )}
            <Link to={user ? "/account" : "/auth"} className="p-2 text-foreground hover:text-secondary transition-colors" aria-label="Account"><User size={20} /></Link>
            <Link to="/cart" className="relative p-2 text-foreground hover:text-secondary transition-colors" aria-label="Cart">
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{itemCount}</span>
              )}
            </Link>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden bg-background border-t border-border px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <div key={link.label}>
                <Link to={link.href} onClick={() => setMobileOpen(false)} className="block py-2 text-foreground font-medium">{link.label}</Link>
                {link.children && (
                  <div className="pl-4 space-y-1">
                    {link.children.map((child) => (
                      <Link key={child.label} to={child.href} onClick={() => setMobileOpen(false)} className="block py-1.5 text-sm text-muted-foreground">{child.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="block py-2 text-secondary font-medium">Admin Dashboard</Link>
            )}
          </nav>
        )}
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};

export default Header;
