export const PASSWORD_REQUIREMENTS = [
  "At least 8 characters",
  "Uppercase letter",
  "Lowercase letter",
  "At least one number",
] as const;

export function passwordRequirementState(password: string) {
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

export function validateAccountPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 72) {
    return "Password must be 72 characters or fewer.";
  }
  const state = passwordRequirementState(password);
  if (!state.hasUppercase || !state.hasLowercase || !state.hasNumber) {
    return "Password must include an uppercase letter, a lowercase letter, and a number.";
  }
  return null;
}
