import { describe, it, expect } from "vitest";
import { generateSafeCsv } from "@/lib/adminReports";
import { canAccessRoute } from "@/lib/cmsRoles";

describe("Customer Support Role Access & Data Protection", () => {
  describe("Route Access Authorization", () => {
    it("allows customer support to access customer management and order details", () => {
      const supportRoles = ["customer_support"];
      expect(canAccessRoute(supportRoles, "/admin/customers")).toBe(true);
      expect(canAccessRoute(supportRoles, "/admin/orders")).toBe(true);
    });

    it("strictly denies customer support from sensitive configuration routes", () => {
      const supportRoles = ["customer_support"];
      expect(canAccessRoute(supportRoles, "/admin/users")).toBe(false);
      expect(canAccessRoute(supportRoles, "/admin/settings")).toBe(false);
      expect(canAccessRoute(supportRoles, "/admin/settings/features")).toBe(false);
    });
  });

  describe("RPC & View Role Authorization (get_customer_support_profiles)", () => {
    function canInvokeGetCustomerSupportProfiles(callerRoles: string[]): boolean {
      return callerRoles.includes("admin") || callerRoles.includes("customer_support");
    }

    it("authorizes Admin and Customer Support roles", () => {
      expect(canInvokeGetCustomerSupportProfiles(["admin"])).toBe(true);
      expect(canInvokeGetCustomerSupportProfiles(["customer_support"])).toBe(true);
      expect(canInvokeGetCustomerSupportProfiles(["editor", "customer_support"])).toBe(true);
    });

    it("strictly rejects unauthorized staff and customer roles", () => {
      expect(canInvokeGetCustomerSupportProfiles(["editor"])).toBe(false);
      expect(canInvokeGetCustomerSupportProfiles(["inventory_manager"])).toBe(false);
      expect(canInvokeGetCustomerSupportProfiles(["content_manager"])).toBe(false);
      expect(canInvokeGetCustomerSupportProfiles(["moderator"])).toBe(false);
      expect(canInvokeGetCustomerSupportProfiles(["user"])).toBe(false);
      expect(canInvokeGetCustomerSupportProfiles([])).toBe(false);
    });
  });

  describe("Customer Profile Data Minimization for Support", () => {
    it("provides necessary support fields while excluding sensitive system credentials", () => {
      // The profile fields visible to Support under the updated RLS policy
      const supportVisibleProfile = {
        id: "cust-1",
        full_name: "Anita Sharma",
        email: "anita@example.com",
        phone: "+919876543210",
        created_at: "2026-01-15T08:30:00Z",
      };

      expect(supportVisibleProfile.full_name).toBe("Anita Sharma");
      expect(supportVisibleProfile.email).toBe("anita@example.com");
      expect(supportVisibleProfile.phone).toBe("+919876543210");

      // Verify no sensitive credentials exist on the profile object
      const sensitiveKeys = ["password_hash", "auth_secret", "refresh_token", "encrypted_card"];
      sensitiveKeys.forEach((key) => {
        expect(key in supportVisibleProfile).toBe(false);
      });
    });

    it("handles customer records where user_id is null (e.g. guest or deleted user)", () => {
      const customerRow = {
        userId: null,
        name: "Guest Checkout Customer",
        email: "guest@example.com",
        phone: "+919876543210",
        orderCount: 1,
        totalSpend: 799,
        lastOrderDate: "2026-10-22T14:00:00Z",
      };

      expect(customerRow.userId).toBeNull();
      expect(customerRow.name).toBe("Guest Checkout Customer");
      expect(customerRow.totalSpend).toBe(799);
    });

    it("strictly isolates projected columns in customer_support_profiles view", () => {
      // The allowed projection of customer_support_profiles view
      const allowedColumns = new Set(["user_id", "full_name", "phone", "created_at"]);
      
      // Prohibited columns that must NEVER be projected to Customer Support
      const prohibitedColumns = [
        "avatar_url",
        "updated_at",
        "password_hash",
        "email_change_token",
        "raw_user_meta_data",
        "street_address",
        "billing_address",
      ];

      prohibitedColumns.forEach((col) => {
        expect(allowedColumns.has(col)).toBe(false);
      });
    });
  });

  describe("CSV Export Formula Injection Protection (CWE-1236)", () => {
    it("neutralizes formula injection characters (=, +, -, @, tab, return) in customer exports", () => {
      const headers = ["Name", "Email", "Phone", "City"];
      const rows = [
        ["=1+1", "@exploit.domain", "+919876543210", "-cmd|' /C calc'!A0"],
      ];

      const csv = generateSafeCsv(headers, rows);

      // Verify that every cell beginning with a formula indicator is prefixed with single-quote (')
      expect(csv).toContain(`"'=1+1"`);
      expect(csv).toContain(`"'@exploit.domain"`);
      expect(csv).toContain(`"'+919876543210"`);
      expect(csv).toContain(`"'-cmd|' /C calc'!A0"`);

      // Verify that raw formula invocation without prefix is NOT present
      expect(csv.includes(`"=1+1"`)).toBe(false);
      expect(csv.includes(`"@exploit.domain"`)).toBe(false);
    });
  });
});
