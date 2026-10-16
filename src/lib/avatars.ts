/**
 * Central Avatar Selection & Management Utility for Enrollaa Internship
 * Reuses actual brand avatar assets from Enrollaa Waitlist (/avatars/avatar1.jpg - avatar6.jpg)
 */

export const MALE_AVATARS = [
  "/avatars/avatar1.jpg",
  "/avatars/avatar2.jpg",
  "/avatars/avatar4.jpg",
];

export const FEMALE_AVATARS = [
  "/avatars/avatar3.jpg",
  "/avatars/avatar5.jpg",
  "/avatars/avatar6.jpg",
];

export const ALL_AVATARS = [
  "/avatars/avatar1.jpg",
  "/avatars/avatar2.jpg",
  "/avatars/avatar3.jpg",
  "/avatars/avatar4.jpg",
  "/avatars/avatar5.jpg",
  "/avatars/avatar6.jpg",
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface AvatarUser {
  id?: string;
  email?: string;
  first_name?: string;
  surname?: string;
  avatar_url?: string;
  photo_url?: string;
  sex?: "Male" | "Female";
  gender?: "Male" | "Female";
}

/**
 * Returns a stable, deterministic avatar URL for any user without random jitter across renders.
 * Respects explicit user photos first, then explicit gender categories if specified (without inferring from names).
 */
export function getStableAvatar(user?: AvatarUser | null): string {
  if (!user) return ALL_AVATARS[0];

  // 1. Explicit uploaded photograph or custom avatar
  if (user.photo_url && user.photo_url.trim()) {
    return user.photo_url.trim();
  }
  if (user.avatar_url && user.avatar_url.trim()) {
    return user.avatar_url.trim();
  }

  // 2. Deterministic key
  const key = (user.id || user.email || `${user.first_name || ""}-${user.surname || ""}`).toLowerCase();
  const hash = simpleHash(key);

  // 3. Category based on recorded gender/sex without name guessing
  const sex = user.sex || user.gender;
  if (sex === "Male") {
    return MALE_AVATARS[hash % MALE_AVATARS.length];
  }
  if (sex === "Female") {
    return FEMALE_AVATARS[hash % FEMALE_AVATARS.length];
  }

  // 4. Default: evenly distribute across all 6 brand avatars
  return ALL_AVATARS[hash % ALL_AVATARS.length];
}
