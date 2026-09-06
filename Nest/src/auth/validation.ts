// Field validation helpers shared across the onboarding/auth screens.
// Each validator returns an error message string, or null when the value is valid.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address.";
  return null;
}

// One-time login code: exactly 6 digits.
export function validateOtpCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Enter the code we sent you.";
  if (!/^\d{6}$/.test(trimmed)) return "Enter the 6-digit code.";
  return null;
}

export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Full name is required.";
  if (trimmed.length < 2) return "Enter your full name.";
  return null;
}

// Phone number is optional. When provided, it must look like a valid number:
// digits, spaces, dashes, parens, and an optional leading +, with 10–15 digits
// once separators are stripped. An empty value is allowed.
export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) {
    return "Enter a valid phone number.";
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return "Enter a valid phone number.";
  }
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
