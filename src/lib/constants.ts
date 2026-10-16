import { DepartmentName, AttendancePolicy } from "@/types";

export const ENROLLAA_DEPARTMENTS: DepartmentName[] = [
  "Product Research & Strategy",
  "AI / Monitoring / ML Engineering",
  "Backend Engineering",
  "Frontend Engineering",
  "UI/UX Design",
  "Content & Operations",
];

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  standard_target_time_wat: "09:00:00",
  grace_period_minutes: 15,
  late_cutoff_time_wat: "10:30:00",
  workdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  time_zone: "Africa/Lagos",
};

export const DEFAULT_GIVEAWAY_CONFIG = {
  prize_1st: 3000,
  prize_2nd: 2000,
  total_budget: 5000,
  punctuality_weight: 50,
  task_weight: 50,
};

export const ENROLLAA_RESUMPTION_DATE = "Monday, October 19, 2026";
export const ENROLLAA_TIMEZONE = "Africa/Lagos";

export const OWNERSHIP_AGREEMENT_VERSION = "v1.0-2026";
export const OWNERSHIP_AGREEMENT_TEXT = `
ENROLLAA INTERNSHIP TERMS, CONFIDENTIALITY & INTELLECTUAL PROPERTY AGREEMENT
Version: ${OWNERSHIP_AGREEMENT_VERSION} | Effective: October 19, 2026

1. Project Ownership: All deliverables, source code, designs, documentation, and product inventions created in connection with the Enrollaa Internship Program are governed by Enrollaa's written agreement and remain the proprietary assets of Enrollaa.
2. Contributor Integrity: Interns agree never to falsely claim the collective work of Enrollaa or another team contributor as their sole independent creation.
3. Portfolio & Professional Profiles: Interns may showcase approved projects and their genuine verified contributions in personal portfolios, resumes, and LinkedIn profiles, subject to confidentiality rules and prior authorization.
4. Non-Disclosure & Confidentiality: Internal platform logic, unreleased admission data signals, database configurations, business metrics, and personal user data must never be shared, copied, or published outside the platform.
5. Code of Conduct & Policies: Interns agree to maintain professional standards, punctuality, and respect across all operational workflows.
`;

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

export const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Keystone Bank",
  "Kuda Bank",
  "Moniepoint MFB",
  "Opay",
  "Palmpay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank / ALAT",
  "Zenith Bank"
];
