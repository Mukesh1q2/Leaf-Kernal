import { describe, it, expect } from "vitest";
import { validateRegistrationInput, formatAuthError, sanitizeRedirectPath } from "@/lib/authValidation";

describe("Email Registration Validation", () => {
  const validPayload = {
    fullName: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    password: "Password123!",
    confirmPassword: "Password123!",
    agreedToTerms: true,
  };

  it("should accept valid registration input", () => {
    const result = validateRegistrationInput(validPayload);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it("should reject empty or single-character full name", () => {
    const resEmpty = validateRegistrationInput({ ...validPayload, fullName: "" });
    expect(resEmpty.isValid).toBe(false);
    expect(resEmpty.errors.fullName).toBe("Full name is required.");

    const resShort = validateRegistrationInput({ ...validPayload, fullName: "A" });
    expect(resShort.isValid).toBe(false);
    expect(resShort.errors.fullName).toBe("Full name must be at least 2 characters.");
  });

  it("should reject invalid email formats", () => {
    const invalidEmails = ["plainaddress", "@missinguser.com", "user@.com", "user@domain..com"];
    for (const email of invalidEmails) {
      const res = validateRegistrationInput({ ...validPayload, email });
      expect(res.isValid).toBe(false);
      expect(res.errors.email).toBe("Please enter a valid email address.");
    }
  });

  it("should enforce strong password rules (min 8 chars, letters and numbers)", () => {
    const resShort = validateRegistrationInput({ ...validPayload, password: "Pass1", confirmPassword: "Pass1" });
    expect(resShort.isValid).toBe(false);
    expect(resShort.errors.password).toBe("Password must be at least 8 characters long.");

    const resNoDigits = validateRegistrationInput({ ...validPayload, password: "PasswordOnly", confirmPassword: "PasswordOnly" });
    expect(resNoDigits.isValid).toBe(false);
    expect(resNoDigits.errors.password).toBe("Password must contain both letters and numbers.");
  });

  it("should reject mismatched confirmation passwords", () => {
    const res = validateRegistrationInput({
      ...validPayload,
      confirmPassword: "DifferentPassword456",
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.confirmPassword).toBe("Passwords do not match.");
  });

  it("should require agreement to terms and privacy policy", () => {
    const res = validateRegistrationInput({
      ...validPayload,
      agreedToTerms: false,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.terms).toBe("You must agree to the Terms & Conditions and Privacy Policy.");
  });
});

describe("Auth Error Message Formatting", () => {
  it("translates user_already_exists into an actionable message", () => {
    const msg = formatAuthError({ message: "User already registered" });
    expect(msg).toContain("An account with this email already exists");
  });

  it("translates invalid credentials error", () => {
    const msg = formatAuthError({ message: "Invalid login credentials" });
    expect(msg).toContain("Invalid email or password");
  });

  it("translates unconfirmed email error", () => {
    const msg = formatAuthError({ message: "Email not confirmed" });
    expect(msg).toContain("Please confirm your email address");
  });

  it("translates rate limit errors", () => {
    const msg = formatAuthError({ message: "over_email_send_rate_limit" });
    expect(msg).toContain("Too many requests");
  });
});

describe("Open Redirect Protection (CWE-601)", () => {
  it("allows safe, relative same-origin paths", () => {
    expect(sanitizeRedirectPath("/track/7b949c5e-8d2b-4e1a-9f3c-1a2b3c4d5e6f")).toBe("/track/7b949c5e-8d2b-4e1a-9f3c-1a2b3c4d5e6f");
    expect(sanitizeRedirectPath("/account#orders")).toBe("/account#orders");
    expect(sanitizeRedirectPath("/cart?coupon=LEAF20")).toBe("/cart?coupon=LEAF20");
    expect(sanitizeRedirectPath("/shop")).toBe("/shop");
  });

  it("blocks protocol-relative open redirect attacks", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/");
    expect(sanitizeRedirectPath("//evil.com/phishing")).toBe("/");
    expect(sanitizeRedirectPath("///evil.com")).toBe("/");
  });

  it("blocks backslash and Windows path normalization attacks", () => {
    expect(sanitizeRedirectPath("/\\evil.com")).toBe("/");
    expect(sanitizeRedirectPath("/\\\\evil.com")).toBe("/");
    expect(sanitizeRedirectPath("\\evil.com")).toBe("/");
    expect(sanitizeRedirectPath("\\\\evil.com")).toBe("/");
  });

  it("blocks external absolute URL schemes", () => {
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
    expect(sanitizeRedirectPath("http://evil.com/login")).toBe("/");
    expect(sanitizeRedirectPath("ftp://attacker.com")).toBe("/");
  });

  it("blocks dangerous script schemes", () => {
    expect(sanitizeRedirectPath("javascript:alert(document.cookie)")).toBe("/");
    expect(sanitizeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/");
    expect(sanitizeRedirectPath("vbscript:msgbox(1)")).toBe("/");
  });

  it("blocks URL-encoded evasions", () => {
    expect(sanitizeRedirectPath("/%2f%2fevil.com")).toBe("/");
    expect(sanitizeRedirectPath("/%5c%5cevil.com")).toBe("/");
    expect(sanitizeRedirectPath("%2f%2fevil.com")).toBe("/");
  });

  it("blocks carriage return and newline header injection characters", () => {
    expect(sanitizeRedirectPath("/test\r\nSet-Cookie:evil=1")).toBe("/");
    expect(sanitizeRedirectPath("/test\nevil")).toBe("/");
  });

  it("safely falls back for null, undefined, and empty inputs", () => {
    expect(sanitizeRedirectPath(null)).toBe("/");
    expect(sanitizeRedirectPath(undefined)).toBe("/");
    expect(sanitizeRedirectPath("")).toBe("/");
    expect(sanitizeRedirectPath("   ")).toBe("/");
    expect(sanitizeRedirectPath(null, "/custom-fallback")).toBe("/custom-fallback");
  });
});

