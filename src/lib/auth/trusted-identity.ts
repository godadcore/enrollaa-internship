import { ENROLLAA_DEPARTMENTS } from "@/lib/constants";
import type { DepartmentName, UserProfile } from "@/types";

const IDENTITY_KEYS = [
  "id",
  "email",
  "role",
  "first_name",
  "surname",
  "role_title",
  "department",
  "department_id",
  "is_active",
  "created_at",
] as const;

export const UNAUTHENTICATED_PROFILE: UserProfile = {
  id: "unauthenticated",
  email: "",
  role: "intern",
  first_name: "",
  surname: "",
  role_title: "",
  department_id: null,
  is_active: false,
  created_at: "",
};

export function departmentNameFromValue(value: unknown): DepartmentName | undefined {
  return ENROLLAA_DEPARTMENTS.find((name) => name === value);
}

export function applyTrustedIdentity(source: Partial<UserProfile> | undefined, trusted: UserProfile): UserProfile {
  return {
    ...(source ?? {}),
    ...trusted,
    id: trusted.id,
    email: trusted.email,
    role: trusted.role,
    first_name: trusted.first_name,
    surname: trusted.surname,
    role_title: trusted.role_title,
    department: trusted.department,
    department_id: trusted.department_id ?? null,
    is_active: trusted.is_active,
    created_at: trusted.created_at,
  };
}

export function mergeTrustedIdentity(profiles: UserProfile[], trusted: UserProfile): UserProfile[] {
  const trustedEmail = trusted.email.toLowerCase();
  const existing = profiles.find((profile) => profile.id === trusted.id || profile.email.toLowerCase() === trustedEmail);
  return [
    applyTrustedIdentity(existing, trusted),
    ...profiles.filter((profile) => profile.id !== trusted.id && profile.email.toLowerCase() !== trustedEmail),
  ];
}

export function publicProfileUpdates(updates: Partial<UserProfile>): Partial<UserProfile> {
  const next: Partial<UserProfile> = { ...updates };
  for (const key of IDENTITY_KEYS) {
    delete next[key];
  }
  return next;
}

