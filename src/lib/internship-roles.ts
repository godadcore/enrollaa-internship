/** Official internship job categories. Distinct from account permission roles. */
export const OFFICIAL_INTERNSHIP_ROLES = [
  { slug: "frontend-developer", name: "Frontend Developer", sortOrder: 1 },
  { slug: "backend-developer", name: "Backend Developer", sortOrder: 2 },
  { slug: "ui-ux-developer", name: "UI/UX Developer", sortOrder: 3 },
  { slug: "ui-ux-designer", name: "UI/UX Designer", sortOrder: 4 },
  { slug: "data-researcher", name: "Data Researcher", sortOrder: 5 },
  { slug: "graphic-designer", name: "Graphic Designer", sortOrder: 6 },
] as const;

export const OFFICIAL_INTERNSHIP_ROLE_NAMES = OFFICIAL_INTERNSHIP_ROLES.map((role) => role.name);

export function isOfficialInternshipRole(name: string): boolean {
  return (OFFICIAL_INTERNSHIP_ROLE_NAMES as readonly string[]).includes(name.trim());
}

export function internshipRoleSelectOptions(currentTitle?: string) {
  const options = OFFICIAL_INTERNSHIP_ROLES.map((role) => ({ value: role.name, label: role.name }));
  const current = currentTitle?.trim();
  if (current && !isOfficialInternshipRole(current)) {
    return [{ value: current, label: `${current} (existing)` }, ...options];
  }
  return options;
}
