import "server-only";

import crypto from "crypto";
import { DataAccessError } from "@/lib/data/errors";

function bankKey(): Buffer {
  const configured = process.env.ONBOARDING_BANK_KEY?.trim();
  if (configured && /^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new DataAccessError("Bank details cannot be stored in this environment.", 503);
  return crypto.createHash("sha256").update(`onboarding-bank:${secret}`).digest();
}

export function encryptAccountNumber(accountNumber: string): {
  ciphertext: Buffer;
  nonce: Buffer;
  authenticationTag: Buffer;
  last4: string;
  keyVersion: string;
} {
  const digits = accountNumber.replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) {
    throw new DataAccessError("Nigerian account numbers must be exactly 10 digits.", 400);
  }
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", bankKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  return {
    ciphertext,
    nonce,
    authenticationTag: cipher.getAuthTag(),
    last4: digits.slice(-4),
    keyVersion: "v1",
  };
}
