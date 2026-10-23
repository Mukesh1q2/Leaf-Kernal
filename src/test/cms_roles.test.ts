import { describe, it, expect } from "vitest";
import {
  isCmsStaffRole,
  hasAnyCmsRole,
  canAccessRoute,
  getPrimaryRoleBadge,
  getRoleDisplayLabel,
  CMS_STAFF_ROLES,
} from "../lib/cmsRoles";

describe("CMS Roles & Least-Privilege Permissions", () => {
  it("recognizes all 6 staff roles and rejects customer 'user' role", () => {
    expect(CMS_STAFF_ROLES).toEqual([
      "admin",
      "editor",
      "content_manager",
      "inventory_manager",
      "customer_support",
      "moderator",
    ]);

    expect(isCmsStaffRole("admin")).toBe(true);
    expect(isCmsStaffRole("editor")).toBe(true);
    expect(isCmsStaffRole("content_manager")).toBe(true);
    expect(isCmsStaffRole("inventory_manager")).toBe(true);
    expect(isCmsStaffRole("customer_support")).toBe(true);
    expect(isCmsStaffRole("moderator")).toBe(true);

    // Storefront customer role must NOT be a CMS staff role
    expect(isCmsStaffRole("user")).toBe(false);
    expect(isCmsStaffRole("guest")).toBe(false);
    expect(isCmsStaffRole("")).toBe(false);
  });

  it("evaluates hasAnyCmsRole correctly", () => {
    expect(hasAnyCmsRole(["user"])).toBe(false);
    expect(hasAnyCmsRole([])).toBe(false);
    expect(hasAnyCmsRole(["user", "customer_support"])).toBe(true);
    expect(hasAnyCmsRole(["inventory_manager"])).toBe(true);
  });

  describe("canAccessRoute least-privilege matrix", () => {
    it("grants Admin unrestricted access to all routes", () => {
      const adminRoles = ["admin"];
      expect(canAccessRoute(adminRoles, "/admin")).toBe(true);
      expect(canAccessRoute(adminRoles, "/admin/users")).toBe(true);
      expect(canAccessRoute(adminRoles, "/admin/settings")).toBe(true);
      expect(canAccessRoute(adminRoles, "/admin/orders")).toBe(true);
      expect(canAccessRoute(adminRoles, "/admin/inventory")).toBe(true);
      expect(canAccessRoute(adminRoles, "/admin/blog")).toBe(true);
      expect(canAccessRoute(adminRoles, "/admin/analytics")).toBe(true);
    });

    it("restricts Editor to content and catalog routes only", () => {
      const editorRoles = ["editor"];
      // Allowed
      expect(canAccessRoute(editorRoles, "/admin")).toBe(true);
      expect(canAccessRoute(editorRoles, "/admin/blog")).toBe(true);
      expect(canAccessRoute(editorRoles, "/admin/products")).toBe(true);
      expect(canAccessRoute(editorRoles, "/admin/categories")).toBe(true);
      expect(canAccessRoute(editorRoles, "/admin/faqs")).toBe(true);
      expect(canAccessRoute(editorRoles, "/admin/banners")).toBe(true);

      // Denied
      expect(canAccessRoute(editorRoles, "/admin/users")).toBe(false);
      expect(canAccessRoute(editorRoles, "/admin/orders")).toBe(false);
      expect(canAccessRoute(editorRoles, "/admin/customers")).toBe(false);
      expect(canAccessRoute(editorRoles, "/admin/settings")).toBe(false);
      expect(canAccessRoute(editorRoles, "/admin/analytics")).toBe(false);
      expect(canAccessRoute(editorRoles, "/admin/inventory")).toBe(false);
    });

    it("restricts Inventory Manager to inventory, deliveries, and pincodes", () => {
      const invRoles = ["inventory_manager"];
      // Allowed
      expect(canAccessRoute(invRoles, "/admin")).toBe(true);
      expect(canAccessRoute(invRoles, "/admin/inventory")).toBe(true);
      expect(canAccessRoute(invRoles, "/admin/deliveries")).toBe(true);
      expect(canAccessRoute(invRoles, "/admin/products")).toBe(true);
      expect(canAccessRoute(invRoles, "/admin/pincodes")).toBe(true);

      // Denied
      expect(canAccessRoute(invRoles, "/admin/users")).toBe(false);
      expect(canAccessRoute(invRoles, "/admin/blog")).toBe(false);
      expect(canAccessRoute(invRoles, "/admin/orders")).toBe(false);
      expect(canAccessRoute(invRoles, "/admin/customers")).toBe(false);
      expect(canAccessRoute(invRoles, "/admin/settings")).toBe(false);
    });

    it("restricts Customer Support to orders, deliveries, customers, and inquiries", () => {
      const csRoles = ["customer_support"];
      // Allowed
      expect(canAccessRoute(csRoles, "/admin")).toBe(true);
      expect(canAccessRoute(csRoles, "/admin/orders")).toBe(true);
      expect(canAccessRoute(csRoles, "/admin/deliveries")).toBe(true);
      expect(canAccessRoute(csRoles, "/admin/customers")).toBe(true);
      expect(canAccessRoute(csRoles, "/admin/inquiries")).toBe(true);
      expect(canAccessRoute(csRoles, "/admin/subscriptions")).toBe(true);
      expect(canAccessRoute(csRoles, "/admin/abandoned-carts")).toBe(true);

      // Denied
      expect(canAccessRoute(csRoles, "/admin/users")).toBe(false);
      expect(canAccessRoute(csRoles, "/admin/settings")).toBe(false);
      expect(canAccessRoute(csRoles, "/admin/inventory")).toBe(false);
      expect(canAccessRoute(csRoles, "/admin/analytics")).toBe(false);
      expect(canAccessRoute(csRoles, "/admin/blog")).toBe(false);
    });

    it("restricts Moderator to reviews, testimonials, and inquiries", () => {
      const modRoles = ["moderator"];
      // Allowed
      expect(canAccessRoute(modRoles, "/admin")).toBe(true);
      expect(canAccessRoute(modRoles, "/admin/reviews")).toBe(true);
      expect(canAccessRoute(modRoles, "/admin/testimonials")).toBe(true);
      expect(canAccessRoute(modRoles, "/admin/inquiries")).toBe(true);

      // Denied
      expect(canAccessRoute(modRoles, "/admin/users")).toBe(false);
      expect(canAccessRoute(modRoles, "/admin/orders")).toBe(false);
      expect(canAccessRoute(modRoles, "/admin/settings")).toBe(false);
      expect(canAccessRoute(modRoles, "/admin/inventory")).toBe(false);
      expect(canAccessRoute(modRoles, "/admin/blog")).toBe(false);
    });

    it("denies Storefront customer role completely", () => {
      const userRoles = ["user"];
      expect(canAccessRoute(userRoles, "/admin")).toBe(false);
      expect(canAccessRoute(userRoles, "/admin/orders")).toBe(false);
      expect(canAccessRoute(userRoles, "/admin/products")).toBe(false);
      expect(canAccessRoute(userRoles, "/admin/users")).toBe(false);
    });
  });

  describe("Badge and display label formatting", () => {
    it("prioritizes Master Admin badge over all others", () => {
      expect(getPrimaryRoleBadge(["admin"], true)).toBe("Master Admin");
      expect(getPrimaryRoleBadge(["editor"], true)).toBe("Master Admin");
    });

    it("returns correct badges for individual staff roles", () => {
      expect(getPrimaryRoleBadge(["admin"], false)).toBe("Administrator");
      expect(getPrimaryRoleBadge(["content_manager"], false)).toBe("Content Manager");
      expect(getPrimaryRoleBadge(["editor"], false)).toBe("Editor");
      expect(getPrimaryRoleBadge(["inventory_manager"], false)).toBe("Inventory Manager");
      expect(getPrimaryRoleBadge(["customer_support"], false)).toBe("Customer Support");
      expect(getPrimaryRoleBadge(["moderator"], false)).toBe("Moderator");
      expect(getPrimaryRoleBadge(["user"], false)).toBe("Staff");
    });

    it("returns friendly display labels", () => {
      expect(getRoleDisplayLabel("admin")).toBe("Administrator");
      expect(getRoleDisplayLabel("user")).toBe("Customer (Storefront)");
      expect(getRoleDisplayLabel("customer_support")).toBe("Customer Support");
    });
  });
});
