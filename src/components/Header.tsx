import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag, User, ChevronDown, Shield, Sparkles, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { supabase } from "@/integrations/supabase/client";
import SearchDialog from "@/components/SearchDialog";
import NotificationBell from "@/components/NotificationBell";
import { useLoyaltyBalance } from "@/lib/loyalty";
import uvediqLogo from "@/assets/uvediq-logo.png";
import StorefrontPromoStrip from "@/components/StorefrontPromoStrip";

const Header = () => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [concerns, setConcerns] = useState<{ slug: string; name: string }[]>([]);
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { itemCount: wishlistCount } = useWishlist();
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

  // Load dynamic nav data respecting sort_order
  useEffect(() => {
    supabase.from("categories").select("slug,name").order("sort_order").then(({ data }) => setCategories(data || []));
    supabase.from("health_concerns").select("slug,name").order("sort_order").then(({ data }) => setConcerns(data || []));
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    {
      label: "Shop",
      href: "/shop",
      children: [
        { label: "All Products", href: "/shop" },
        ...categories.map((c) => ({ label: c.name, href: `/shop?category=${c.slug}` })),
      ],
    },
    { label: "Combos & Bundles", href: "/bundles" },
    ...(concerns.length > 0 ? [{
      label: "Shop by Goal",
      href: "/shop",
      children: concerns.map((c) => ({ label: c.name, href: `/shop?concern=${c.slug}` })),
    }] : []),
    { label: "About", href: "/about" },
    { label: "Quiz", href: "/quiz" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <StorefrontPromoStrip />

        <div className="container flex h-16 items-center justify-between gap-2 py-1.5 md:h-24 md:py-2">
          <Link to="/" className="flex shrink-0 items-center gap-3 py-1" aria-label="UVEDIQ Home">
            <img
              src={uvediqLogo}
              alt="UVEDIQ"
              className="h-11 w-auto object-contain drop-shadow-sm md:h-20"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
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

          <div className="flex shrink-0 items-center gap-0.5 md:gap-2">
            <button onClick={() => setSearchOpen(true)} className="rounded-full p-2.5 text-foreground transition-colors hover:bg-muted hover:text-secondary" aria-label="Search products">
              <Search size={20} />
            </button>
            <div className="hidden lg:block"><NotificationBell /></div>
            {user && loyaltyBalance > 0 && (
              <Link to="/loyalty" className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-colors text-xs font-semibold text-secondary" title="Loyalty points">
                <Sparkles size={12} />
                {loyaltyBalance}
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="hidden p-2 text-secondary transition-colors hover:text-primary lg:block" aria-label="Admin" title="Admin Dashboard">
                <Shield size={20} />
              </Link>
            )}
            <Link to="/wishlist" className="relative hidden p-2 text-foreground transition-colors hover:text-secondary lg:block" aria-label="Wishlist">
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{wishlistCount}</span>
              )}
            </Link>
            <Link to={user ? "/account" : "/auth"} className="hidden p-2 text-foreground transition-colors hover:text-secondary lg:block" aria-label="Account"><User size={20} /></Link>
            <Link to="/cart" className="relative rounded-full p-2.5 text-foreground transition-colors hover:bg-muted hover:text-secondary" aria-label={`Cart${itemCount ? `, ${itemCount} items` : ""}`}>
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{itemCount}</span>
              )}
            </Link>
          </div>
        </div>

      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};

export default Header;
