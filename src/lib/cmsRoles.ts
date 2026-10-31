/**
 * CMS Role & Least-Privilege Permission Definitions
 * 
 * Defines all supported roles, route permissions, and capability helpers.
 * Supported roles from public.app_role enum:
 *  - 'admin'
 *  - 'editor'
 *  - 'content_manager'
 *  - 'inventory_manager'
 *  - 'customer_support'
 *  - 'moderator'
 *  - 'user' (storefront customer only, NO CMS access)
 */

export type CmsRole =
  | "admin"
  | "editor"
  | "content_manager"
  | "inventory_manager"
  | "customer_support"
  | "moderator"
  | "user";

export const CMS_STAFF_ROLES: CmsRole[] = [
  "admin",
  "editor",
  "content_manager",
  "inventory_manager",
  "customer_support",
  "moderator",
];

export const isCmsStaffRole = (role: string): role is CmsRole => {
  return CMS_STAFF_ROLES.includes(role as CmsRole);
};

export const hasAnyCmsRole = (roles: string[]): boolean => {
  return roles.some((role) => isCmsStaffRole(role));
};

/**
 * Route access permissions map.
 * Each route lists the roles permitted to access it.
 * 'admin' has access to everything.
 */
export const ROUTE_PERMISSIONS: Record<string, CmsRole[]> = {
  "/admin": CMS_STAFF_ROLES,
  "/admin/activity": CMS_STAFF_ROLES,
  "/admin/products": ["admin", "editor", "content_manager", "inventory_manager"],
  "/admin/categories": ["admin", "editor", "content_manager"],
  "/admin/bundles": ["admin", "editor", "content_manager", "inventory_manager"],
  "/admin/health-concerns": ["admin", "editor", "content_manager"],
  "/admin/inventory": ["admin", "inventory_manager"],
  "/admin/orders": ["admin", "customer_support"],
  "/admin/deliveries": ["admin", "customer_support", "inventory_manager"],
  "/admin/customers": ["admin", "customer_support"],
  "/admin/coupons": ["admin"],
  "/admin/subscriptions": ["admin", "customer_support"],
  "/admin/media": ["admin", "editor", "content_manager"],
  "/admin/blog": ["admin", "editor", "content_manager"],
  "/admin/faqs": ["admin", "editor", "content_manager"],
  "/admin/banners": ["admin", "editor", "content_manager"],
  "/admin/announcements": ["admin", "editor", "content_manager"],
  "/admin/testimonials": ["admin", "editor", "content_manager", "moderator"],
  "/admin/analytics": ["admin"],
  "/admin/abandoned-carts": ["admin", "customer_support"],
  "/admin/reviews": ["admin", "moderator", "customer_support", "editor", "content_manager"],
  "/admin/loyalty": ["admin"],
  "/admin/referrals": ["admin"],
  "/admin/users": ["admin"],
  "/admin/pincodes": ["admin", "inventory_manager"],
  "/admin/inquiries": ["admin", "customer_support", "moderator"],
  "/admin/settings": ["admin"],
};

/**
 * Check if a set of roles can access a given route path.
 */
export const canAccessRoute = (roles: string[], pathname: string, isMaster: boolean = false): boolean => {
  // Feature controls route is strictly reserved for Master Admin only
  if (pathname === "/admin/settings/features" || pathname.startsWith("/admin/settings/features")) {
    return Boolean(isMaster);
  }

  // Master or full admin can access all CMS routes
  if (roles.includes("admin")) return true;

  // Find the most specific route match
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!matchedRoute) {
    // If not specifically mapped, allow only admins
    return false;
  }

  const allowedRoles = ROUTE_PERMISSIONS[matchedRoute];
  return roles.some((r) => allowedRoles.includes(r as CmsRole));
};

/**
 * Human-readable role label
 */
export const getRoleDisplayLabel = (role: string): string => {
  switch (role) {
    case "admin":
      return "Administrator";
    case "content_manager":
      return "Content Manager";
    case "editor":
      return "Editor";
    case "inventory_manager":
      return "Inventory Manager";
    case "customer_support":
      return "Customer Support";
    case "moderator":
      return "Moderator";
    case "user":
      return "Customer (Storefront)";
    default:
      return role;
  }
};

/**
 * Header badge title helper
 */
export const getPrimaryRoleBadge = (roles: string[], isMaster: boolean): string => {
  if (isMaster) return "Master Admin";
  if (roles.includes("admin")) return "Administrator";
  if (roles.includes("content_manager")) return "Content Manager";
  if (roles.includes("editor")) return "Editor";
  if (roles.includes("inventory_manager")) return "Inventory Manager";
  if (roles.includes("customer_support")) return "Customer Support";
  if (roles.includes("moderator")) return "Moderator";
  return "Staff";
};
