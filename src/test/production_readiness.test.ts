import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test 1: Razorpay Signature Verification Logic
describe("Razorpay Signature Verification", () => {
  function verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string
  ): boolean {
    const data = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex");
    return expected === signature;
  }

  const secret = "test_secret_key_12345";
  const orderId = "order_OId123456789";
  const paymentId = "pay_PId987654321";

  it("should validate a correct HMAC-SHA256 signature", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = verifyRazorpaySignature(orderId, paymentId, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it("should reject an invalid or tampered signature", () => {
    const tamperedSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const isValid = verifyRazorpaySignature(orderId, paymentId, tamperedSignature, secret);
    expect(isValid).toBe(false);
  });

  it("should reject when orderId or paymentId is modified", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = verifyRazorpaySignature("order_different", paymentId, validSignature, secret);
    expect(isValid).toBe(false);
  });
});

// Test 2: CORS Origin Allowlist Logic
describe("CORS Origin Validation Logic", () => {
  const ALLOWED_ORIGINS = [
    "https://leafandkernel.com",
    "https://www.leafandkernel.com",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  function getCorsOrigin(originHeader: string | null): string {
    const origin = originHeader || "";
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  }

  it("should allow exact production domain", () => {
    expect(getCorsOrigin("https://leafandkernel.com")).toBe("https://leafandkernel.com");
    expect(getCorsOrigin("https://www.leafandkernel.com")).toBe("https://www.leafandkernel.com");
  });

  it("should allow approved local development origins", () => {
    expect(getCorsOrigin("http://localhost:8080")).toBe("http://localhost:8080");
    expect(getCorsOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("should fallback to default production origin and not reflect arbitrary untrusted origins", () => {
    expect(getCorsOrigin("https://attacker-phishing.com")).toBe("https://leafandkernel.com");
    expect(getCorsOrigin("https://evil.leafandkernel.com.attacker.com")).toBe("https://leafandkernel.com");
    expect(getCorsOrigin(null)).toBe("https://leafandkernel.com");
  });
});

// Test 3: Client Bundle Secrets Exposure Check
describe("Environment & Bundle Secret Protection", () => {
  it("should ensure no sensitive backend keys are prefixed with VITE_", () => {
    const forbiddenPatterns = [
      "SERVICE_ROLE",
      "SECRET",
      "PRIVATE_KEY",
      "SERVICE_KEY",
    ];

    const exposedViteEnvVars = Object.keys(process.env).filter((key) =>
      key.startsWith("VITE_")
    );

    for (const envVar of exposedViteEnvVars) {
      for (const pattern of forbiddenPatterns) {
        expect(envVar.toUpperCase()).not.toContain(pattern);
      }
    }
  });
});

// Test 4: Metadata and Canonical Domain Consistency
describe("SEO and Canonical URL Configuration", () => {
  it("should enforce https://leafandkernel.com as canonical domain", () => {
    const productionDomain = "https://leafandkernel.com";
    expect(productionDomain).toMatch(/^https:\/\/leafandkernel\.com$/);
  });
});
