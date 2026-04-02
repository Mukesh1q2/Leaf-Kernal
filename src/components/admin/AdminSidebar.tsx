import {
  LayoutDashboard, Package, ShoppingCart, FileText, HelpCircle,
  ArrowLeft, Star, Gift, Image, Users, Settings, BarChart3, Archive, ClipboardList, Shield,
  PackageOpen, ShoppingBag, Award, UserPlus, FolderTree, Heart, MapPin, MessageSquare
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";

const sections = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Activity Log", url: "/admin/activity", icon: ClipboardList },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", url: "/admin/products", icon: Package },
      { title: "Bundles", url: "/admin/bundles", icon: PackageOpen },
      { title: "Inventory", url: "/admin/inventory", icon: Archive },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
      { title: "Customers", url: "/admin/customers", icon: Users },
      { title: "Coupons", url: "/admin/coupons", icon: Gift },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Blog", url: "/admin/blog", icon: FileText },
      { title: "FAQs", url: "/admin/faqs", icon: HelpCircle },
      { title: "Banners", url: "/admin/banners", icon: Image },
      { title: "Testimonials", url: "/admin/testimonials", icon: Star },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
      { title: "Abandoned Carts", url: "/admin/abandoned-carts", icon: ShoppingBag },
      { title: "Reviews", url: "/admin/reviews", icon: Star },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Loyalty Points", url: "/admin/loyalty", icon: Award },
      { title: "Referrals", url: "/admin/referrals", icon: UserPlus },
    ],
  },
  {
    label: "System",
    items: [
      { title: "User Roles", url: "/admin/users", icon: Shield },
      { title: "Settings", url: "/admin/settings", icon: Settings },
    ],
  },
];

const AdminSidebar = () => {
  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        {sections.map((section) => (
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
