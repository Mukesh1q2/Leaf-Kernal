import {
  LayoutDashboard, Package, ShoppingCart, FileText, HelpCircle,
  ArrowLeft, Star, Gift, Image, Users, Settings, BarChart3, Archive, ClipboardList, Shield,
  PackageOpen, ShoppingBag, Award, UserPlus, FolderTree, Heart, MapPin, MessageSquare, Truck,
  RefreshCw
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCmsAuth } from "./AdminLayout";
import { canAccessRoute } from "@/lib/cmsRoles";

// (sections definitions)

const allSections = [
  {
    label: "Main",
    adminOnly: false,
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Activity Log", url: "/admin/activity", icon: ClipboardList },
    ],
  },
  {
    label: "Catalog",
    adminOnly: false,
    items: [
      { title: "Products", url: "/admin/products", icon: Package },
      { title: "Categories", url: "/admin/categories", icon: FolderTree },
      { title: "Bundles", url: "/admin/bundles", icon: PackageOpen },
      { title: "Health Concerns", url: "/admin/health-concerns", icon: Heart },
      { title: "Inventory", url: "/admin/inventory", icon: Archive },
    ],
  },
  {
    label: "Sales",
    adminOnly: true,
    items: [
      { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
      { title: "Deliveries", url: "/admin/deliveries", icon: Truck },
      { title: "Customers", url: "/admin/customers", icon: Users },
      { title: "Coupons", url: "/admin/coupons", icon: Gift },
      { title: "Subscriptions", url: "/admin/subscriptions", icon: RefreshCw },
    ],
  },
  {
    label: "Content",
    adminOnly: false,
    items: [
      { title: "Media Library", url: "/admin/media", icon: Image },
      { title: "Blog", url: "/admin/blog", icon: FileText },
      { title: "FAQs", url: "/admin/faqs", icon: HelpCircle },
      { title: "Banners", url: "/admin/banners", icon: Image },
      { title: "Testimonials", url: "/admin/testimonials", icon: Star },
    ],
  },
  {
    label: "Insights",
    adminOnly: false,
    items: [
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3, adminOnly: true },
      { title: "Abandoned Carts", url: "/admin/abandoned-carts", icon: ShoppingBag, adminOnly: true },
      { title: "Reviews", url: "/admin/reviews", icon: Star, adminOnly: false },
    ],
  },
  {
    label: "Growth",
    adminOnly: true,
    items: [
      { title: "Loyalty Points", url: "/admin/loyalty", icon: Award },
      { title: "Referrals", url: "/admin/referrals", icon: UserPlus },
    ],
  },
  {
    label: "System",
    adminOnly: true,
    items: [
      { title: "User Roles", url: "/admin/users", icon: Shield },
      { title: "Pincodes", url: "/admin/pincodes", icon: MapPin },
      { title: "Inquiries", url: "/admin/inquiries", icon: MessageSquare },
      { title: "Settings", url: "/admin/settings", icon: Settings },
    ],
  },
];

const AdminSidebar = () => {
  const { roles, isAdmin } = useCmsAuth();

  // Filter sections and items based on role-based access permissions
  const visibleSections = allSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item: any) =>
        isAdmin ? true : canAccessRoute(roles, item.url)
      ),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>{section.label}</span>
              {section.label === "Main" && (
                <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ArrowLeft size={12} /> Store
                </Link>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;
