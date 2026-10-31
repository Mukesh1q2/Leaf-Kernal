export interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  agreedToTerms?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

export function validateRegistrationInput(input: RegistrationInput): ValidationResult {
  const errors: Record<string, string> = {};

  const name = (input.fullName || "").trim();
  if (!name) {
    errors.fullName = "Full name is required.";
  } else if (name.length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  const email = (input.email || "").trim();
  if (!email) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  const password = input.password || "";
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Password must contain both letters and numbers.";
  }

  if (input.confirmPassword !== undefined) {
    if (!input.confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (input.confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  if (input.agreedToTerms !== undefined && !input.agreedToTerms) {
    errors.terms = "You must agree to the Terms & Conditions and Privacy Policy.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatAuthError(error: any): string {
  if (!error) return "An unexpected error occurred. Please try again.";
  const msg = typeof error === "string" ? error : error.message || "";
  const lower = msg.toLowerCase();

  if (lower.includes("user already registered") || lower.includes("user_already_exists")) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Invalid email or password. Please double-check your credentials.";
  }
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox for the verification link.";
  }
  if (lower.includes("over_email_send_rate_limit") || lower.includes("rate limit")) {
    return "Too many requests. Please wait a few minutes before trying again.";
  }
  if (lower.includes("weak_password") || lower.includes("password should be")) {
    return "Password is too weak. Please choose at least 8 characters with letters and numbers.";
  }

  return msg || "Authentication failed. Please try again.";
}

/**
 * Strictly sanitizes redirect paths to prevent Open Redirect attacks (CWE-601).
 * Only allows relative same-origin paths starting with a single '/' followed by valid path characters.
 * Strictly blocks protocol-relative paths ('//'), backslash tricks ('/\\', '\\'),
 * scheme specifications ('javascript:', 'data:', 'https:'), and encoded evasions.
 */
export function sanitizeRedirectPath(rawPath: string | null | undefined, fallback: string = "/"): string {
  if (!rawPath || typeof rawPath !== "string") {
    return fallback;
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    return fallback;
  }

  // Quick reject for protocol-relative or backslash-based evasions and control chars
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.startsWith("\\") ||
    trimmed.includes("\r") ||
    trimmed.includes("\n") ||
    trimmed.includes("\0")
  ) {
    return fallback;
  }

  // Must start with exactly one leading slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Check for scheme presence before any query or hash
  const pathPart = trimmed.split(/[?#]/)[0];
  if (pathPart.includes(":") || pathPart.startsWith("//") || pathPart.startsWith("/\\")) {
    return fallback;
  }

  // Check URL decoding to catch %2f%2f or %5c evasions
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.startsWith("//") ||
      decoded.startsWith("/\\") ||
      decoded.startsWith("\\") ||
      decoded.split(/[?#]/)[0].includes(":")
    ) {
      return fallback;
    }
  } catch {
    // Malformed URI sequence
    return fallback;
  }

  try {
    // Parse against a dummy local base
    const parsed = new URL(trimmed, "http://localhost");
    // Ensure origin is local and pathname starts with single '/'
    if (
      parsed.origin !== "http://localhost" ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.startsWith("/\\")
    ) {
      return fallback;
    }

    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

