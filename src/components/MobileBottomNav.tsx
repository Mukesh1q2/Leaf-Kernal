import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Heart,
  Home,
  LayoutGrid,
  Leaf,
  Menu,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyCmsRole } from "@/lib/cmsRoles";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type MenuLink = { name: string; slug: string; sort_order?: number; is_active?: boolean | null };

const DEFAULT_CATEGORIES: MenuLink[] = [
  { name: "Powders", slug: "powders" },
  { name: "Capsules", slug: "capsules" },
  { name: "Oils & Ghee", slug: "oils-ghee" },
  { name: "Seeds & Grains", slug: "seeds-grains" },
  { name: "Teas & Infusions", slug: "teas-infusions" },
];

const DEFAULT_CONCERNS: MenuLink[] = [
  { name: "Gut Care", slug: "gut-care" },
  { name: "Immunity", slug: "immunity" },
  { name: "Heart Care", slug: "heart-care" },
  { name: "Joint Care", slug: "joint-care" },
  { name: "Sleep Care", slug: "sleep-care" },
  { name: "Skin & Hair", slug: "skin-hair" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const [moreOpen, setMoreOpen] = useState(false);
  const [categories, setCategories] = useState<MenuLink[]>([]);
  const [concerns, setConcerns] = useState<MenuLink[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("categories").select("name,slug,sort_order").order("sort_order").limit(12),
      supabase.from("health_concerns").select("*").order("sort_order").limit(12),
    ]).then(([categoryResult, concernResult]) => {
      if (!active) return;
      if (categoryResult.data) setCategories(categoryResult.data);
      if (concernResult.data) {
        setConcerns(concernResult.data.filter((concern) => concern.is_active !== false));
      }
    }).catch((error) => {
      console.warn("Could not load mobile navigation links:", error);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUserRoles([]);
      return;
    }
    let active = true;
    void supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn("Could not load mobile navigation permissions:", error.message);
        setUserRoles([]);
      } else {
        setUserRoles((data || []).map((row) => row.role));
      }
    });
    return () => {
      active = false;
    };
  }, [user]);

  const isHidden = pathname.startsWith("/admin") || pathname.startsWith("/checkout");
  if (isHidden) return null;

  const shopActive = pathname === "/shop" || pathname.startsWith("/product/") || pathname === "/bundles";
  const moreActive = !["/", "/shop", "/cart"].includes(pathname) && !pathname.startsWith("/product/") && pathname !== "/bundles";
  const accountLink = user ? "/account" : "/auth";
  const cmsStaff = hasAnyCmsRole(userRoles);
  const categoryLinks = (categories.length > 0 ? categories : DEFAULT_CATEGORIES).filter((category) => category.slug !== "bundles");
  const concernLinks = concerns.length > 0 ? concerns : DEFAULT_CONCERNS;

  const menuLinks = [
    { label: "My account", href: accountLink, Icon: UserRound },
    { label: "Wishlist", href: "/wishlist", Icon: Heart },
    { label: "Track an order", href: "/track", Icon: PackageCheck },
    { label: "Wellness quiz", href: "/quiz", Icon: Sparkles },
    { label: "About us", href: "/about", Icon: Leaf },
    { label: "Journal", href: "/blog", Icon: BookOpen },
    { label: "FAQs", href: "/faq", Icon: CircleHelp },
    { label: "Contact", href: "/contact", Icon: MessageCircle },
  ];

  const closeMenu = () => setMoreOpen(false);

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(20,45,26,0.08)] backdrop-blur-lg lg:hidden"
      >
        <div className="grid h-16 grid-cols-4">
          <Link to="/" aria-current={pathname === "/" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname === "/" ? "text-secondary" : "text-muted-foreground"}`}>
            <Home size={21} strokeWidth={pathname === "/" ? 2.4 : 1.8} />
            <span>Home</span>
          </Link>
          <Link to="/shop" aria-current={shopActive ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${shopActive ? "text-secondary" : "text-muted-foreground"}`}>
            <LayoutGrid size={21} strokeWidth={shopActive ? 2.4 : 1.8} />
            <span>Shop</span>
          </Link>
          <Link to="/cart" aria-current={pathname === "/cart" ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname === "/cart" ? "text-secondary" : "text-muted-foreground"}`}>
            <span className="relative">
              <ShoppingBag size={21} strokeWidth={pathname === "/cart" ? 2.4 : 1.8} />
              {itemCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[9px] font-bold leading-none text-secondary-foreground">{itemCount > 99 ? "99+" : itemCount}</span>}
            </span>
            <span>Cart</span>
          </Link>
          <button type="button" aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => setMoreOpen(true)} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${moreOpen || moreActive ? "text-secondary" : "text-muted-foreground"}`}>
            <Menu size={21} strokeWidth={moreOpen || moreActive ? 2.4 : 1.8} />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="left" className="flex w-[min(88vw,23rem)] flex-col gap-0 overflow-hidden p-0">
          <SheetHeader className="border-b border-border px-5 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] text-left">
            <SheetTitle className="font-heading text-xl">Explore Leaf &amp; Kernel</SheetTitle>
            <SheetDescription>Find products and wellness support in a few taps.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
            <section className="border-b border-border py-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shop by category</h2>
                <Link to="/shop" onClick={closeMenu} className="text-xs font-semibold text-secondary">View all</Link>
              </div>
              <div className="divide-y divide-border">
                {categoryLinks.map((category) => (
                  <Link key={category.slug} to={`/shop?category=${encodeURIComponent(category.slug)}`} onClick={closeMenu} className="flex min-h-12 items-center justify-between py-3 text-sm font-medium text-foreground">
                    <span>{category.name}</span><ChevronRight size={16} className="text-muted-foreground" />
                  </Link>
                ))}
                <Link to="/bundles" onClick={closeMenu} className="flex min-h-12 items-center justify-between py-3 text-sm font-medium text-foreground">
                  <span>Bundles &amp; combos</span><ChevronRight size={16} className="text-muted-foreground" />
                </Link>
              </div>
            </section>

            {concernLinks.length > 0 && (
              <section className="border-b border-border py-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shop by wellness goal</h2>
                  <Link to="/shop" onClick={closeMenu} className="text-xs font-semibold text-secondary">View all</Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {concernLinks.map((concern) => (
                    <Link key={concern.slug} to={`/shop?concern=${encodeURIComponent(concern.slug)}`} onClick={closeMenu} className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm font-medium text-foreground transition-colors hover:border-secondary/40 hover:bg-secondary/5">
                      {concern.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 gap-x-4 gap-y-1 py-4">
              {menuLinks.map(({ label, href, Icon }) => (
                <Link key={href} to={href} onClick={closeMenu} className="flex min-h-12 items-center gap-2.5 text-sm text-foreground">
                  <Icon size={17} className="text-secondary" />{label}
                </Link>
              ))}
              {cmsStaff && <Link to="/admin" onClick={closeMenu} className="col-span-2 flex min-h-12 items-center gap-2.5 text-sm text-foreground"><LayoutGrid size={17} className="text-secondary" />Admin dashboard</Link>}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;
