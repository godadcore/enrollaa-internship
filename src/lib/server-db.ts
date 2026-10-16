import "server-only";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  Candidate,
  OnboardingSubmission,
  UserProfile,
  AccountCredentials,
  AuditLog,
  DepartmentName,
  UserRole,
} from "@/types";
import {
  INITIAL_PROFILES,
  INITIAL_CANDIDATES,
  INITIAL_CREDENTIALS,
  INITIAL_SUBMISSIONS,
  INITIAL_AUDIT_LOGS,
} from "./store";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "enrollaa_internship_db.json");

interface ServerDatabase {
  profiles: UserProfile[];
  credentials: AccountCredentials[];
  candidates: Candidate[];
  submissions: OnboardingSubmission[];
  auditLogs: AuditLog[];
}

/**
 * Secure password hashing using PBKDF2 with unique salt
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return { hash: `${salt}:${hash}`, salt };
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  // If storedHash contains salt in format salt:hash
  if (storedHash.includes(":")) {
    const [salt, originalHash] = storedHash.split(":");
    const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return originalHash === testHash;
  }
  // Fallback for default seed accounts
  return storedHash === password;
}

function getInitialDatabase(): ServerDatabase {
  // Pre-hash initial credentials
  const hashedCreds = INITIAL_CREDENTIALS.map((c) => {
    if (c.password_hash && !c.password_hash.includes(":")) {
      const { hash } = hashPassword(c.password_hash);
      return { ...c, password_hash: hash };
    }
    return c;
  });

  return {
    profiles: INITIAL_PROFILES,
    credentials: hashedCreds,
    candidates: INITIAL_CANDIDATES,
    submissions: INITIAL_SUBMISSIONS,
    auditLogs: INITIAL_AUDIT_LOGS,
  };
}

export function readDatabase(): ServerDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDatabase();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }

    const content = fs.readFileSync(DB_FILE, "utf-8");
    const data = JSON.parse(content) as ServerDatabase;

    // Ensure all critical collections exist
    if (!data.candidates) data.candidates = INITIAL_CANDIDATES;
    if (!data.credentials) data.credentials = INITIAL_CREDENTIALS;
    if (!data.profiles) data.profiles = INITIAL_PROFILES;
    if (!data.submissions) data.submissions = INITIAL_SUBMISSIONS;
    if (!data.auditLogs) data.auditLogs = INITIAL_AUDIT_LOGS;

    return data;
  } catch (err) {
    console.error("Error reading server database, falling back to initial data:", err);
    return getInitialDatabase();
  }
}

export function writeDatabase(data: ServerDatabase): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing server database:", err);
  }
}

export function logServerAuditAction(actorId: string, actorName: string, actorRole: UserRole, action: string, targetEntity: string, targetId: string, details: string) {
  const db = readDatabase();
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    action,
    target_entity: targetEntity,
    target_id: targetId,
    details,
    created_at: new Date().toISOString(),
  };
  db.auditLogs.unshift(newLog);
  writeDatabase(db);
}
