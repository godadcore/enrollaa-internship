import "server-only";

import { AuthorizationError, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole, requireDepartmentScope } from "@/lib/data/scope";
import { encryptAccountNumber } from "@/lib/onboarding/bank";
import { signedDocumentUrl, storeOnboardingDocument, type DocumentKind } from "@/lib/onboarding/documents";

function throwOnboardingError(error: unknown): never {
  const message =
    error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/Intern authorization/i.test(message)) throw new AuthorizationError("Intern authorization is required.", 403);
  if (/cannot be edited|cannot be submitted/i.test(message)) {
    throw new DataAccessError("This onboarding record cannot be changed.", 409);
  }
  if (/photograph and CV/i.test(message)) throw new DataAccessError(message, 400);
  if (/signature/i.test(message)) throw new DataAccessError("A typed signature is required.", 400);
  if (/Agreement/i.test(message)) throw new DataAccessError("Agreement evidence is invalid.", 400);
  if (/not found/i.test(message)) throw new DataAccessError("Onboarding submission not found.", 404);
  if (/department/i.test(message)) throw new AuthorizationError("You do not have access to this department.", 403);
  if (/Only submitted/i.test(message)) throw new DataAccessError("Only submitted onboarding can be reviewed.", 409);
  if (/review note/i.test(message)) throw new DataAccessError("A review note is required when requesting corrections.", 400);
  throw new DataAccessError("Unable to process onboarding.", 500);
}

export async function getInternOnboarding(profile: TrustedProfile) {
  if (profile.role !== "intern") throw new AuthorizationError("Intern authorization is required.", 403);
  const db = privilegedDatabase();
  const { data: invitation } = await db
    .from("staff_invitations")
    .select("id, first_name, middle_name, surname, email, role_title, status, department_id, departments(name)")
    .eq("auth_user_id", profile.auth_user_id)
    .maybeSingle();
  if (!invitation) throw new DataAccessError("No activated invitation is available for onboarding.", 404);

  const { data: agreement } = await db
    .from("agreement_versions")
    .select("id, version, title, content")
    .not("published_at", "is", null)
    .is("retired_at", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: submission } = await db
    .from("onboarding_submissions")
    .select("id, status, phone, location_state, location_city, sex, institution, state_of_residence, education_details, typed_signature, review_note, updated_at")
    .eq("staff_invitation_id", invitation.id)
    .maybeSingle();

  const documents = submission
    ? (
        await db
          .from("onboarding_documents")
        .select("kind, original_filename, byte_size, malware_scan_status, available_at")
          .eq("onboarding_submission_id", submission.id)
          .is("deleted_at", null)
      ).data ?? []
    : [];

  const bank = submission
    ? (
        await db
          .from("onboarding_bank_details")
          .select("account_number_last4")
          .eq("onboarding_submission_id", submission.id)
          .maybeSingle()
      ).data
    : null;

  const departmentName = Array.isArray(invitation.departments)
    ? invitation.departments[0]?.name
    : (invitation.departments as { name?: string } | null)?.name;

  return {
    invitation: {
      firstName: invitation.first_name,
      middleName: invitation.middle_name,
      surname: invitation.surname,
      email: invitation.email,
      roleTitle: invitation.role_title,
      department: departmentName ?? "",
      invitationStatus: invitation.status,
    },
    agreement,
    submission: submission
      ? {
          id: submission.id,
          status: submission.status,
          phone: submission.phone,
          locationState: submission.location_state,
          locationCity: submission.location_city,
          sex: submission.sex,
          institution: submission.institution,
          stateOfResidence: submission.state_of_residence,
          educationDetails: submission.education_details,
          reviewNote: submission.review_note,
          updatedAt: submission.updated_at,
          accountLast4: bank?.account_number_last4 ?? null,
          documents,
        }
      : null,
  };
}

export async function saveInternDraft(profile: TrustedProfile, body: Record<string, unknown>) {
  const { data, error } = await privilegedDatabase().rpc("save_onboarding_draft", {
    p_actor_profile_id: profile.id,
    p_phone: typeof body.phone === "string" ? body.phone : "",
    p_location_state: typeof body.locationState === "string" ? body.locationState : "",
    p_location_city: typeof body.locationCity === "string" ? body.locationCity : "",
    p_sex: typeof body.sex === "string" ? body.sex : "",
    p_institution: typeof body.institution === "string" ? body.institution : "",
    p_state_of_residence: typeof body.stateOfResidence === "string" ? body.stateOfResidence : "",
  });
  if (error || !data) throwOnboardingError(error);
  const submissionId = String(data);
  const education = {
    bank_name: typeof body.bankName === "string" ? body.bankName.slice(0, 80) : "",
    account_name: typeof body.accountName === "string" ? body.accountName.slice(0, 120) : "",
  };
  const { error: educationError } = await privilegedDatabase()
    .from("onboarding_submissions")
    .update({ education_details: education, updated_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (educationError) throw new DataAccessError("The draft was created, but extra details could not be saved.", 500);
  return { submissionId };
}

export async function submitInternOnboarding(profile: TrustedProfile, body: Record<string, unknown>) {
  const current = await getInternOnboarding(profile);
  if (!current.submission?.id) throw new DataAccessError("Save a draft before submitting onboarding.", 400);
  if (!current.agreement?.id) throw new DataAccessError("Agreement evidence is invalid.", 400);
  const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber : "";
  const encrypted = encryptAccountNumber(accountNumber);
  const db = privilegedDatabase();

  const { error: bankError } = await db.from("onboarding_bank_details").upsert({
    onboarding_submission_id: current.submission.id,
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    authentication_tag: encrypted.authenticationTag,
    encryption_key_version: encrypted.keyVersion,
    account_number_last4: encrypted.last4,
  }, { onConflict: "onboarding_submission_id" });
  if (bankError) throw new DataAccessError("Payout details could not be stored.", 500);

  const { error: submitError, data } = await db.rpc("submit_onboarding", {
    p_actor_profile_id: profile.id,
    p_typed_signature: typeof body.typedSignature === "string" ? body.typedSignature : "",
    p_agreement_version_id: current.agreement.id,
  });
  if (submitError || !data) throwOnboardingError(submitError);
  return { submissionId: String(data) };
}

export async function uploadInternDocument(profile: TrustedProfile, kind: DocumentKind, filename: string, buffer: Buffer) {
  const current = await getInternOnboarding(profile);
  if (current.submission && !["draft", "rejected"].includes(current.submission.status)) {
    throw new DataAccessError("This onboarding record cannot be changed.", 409);
  }
  const submissionId = current.submission?.id ?? (await saveInternDraft(profile, {})).submissionId;
  return storeOnboardingDocument({ actor: profile, submissionId, kind, filename, buffer });
}

export async function listReviewSubmissions(profile: TrustedProfile) {
  if (!["admin", "super_admin", "lead", "manager"].includes(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  const db = privilegedDatabase();
  // Invitations are the authoritative roster. A submission is optional until an
  // intern saves their first draft, so reading from submissions alone hides both
  // "Not started" interns and draft records.
  let query = db
    .from("staff_invitations")
    .select("id, first_name, surname, email, role_title, status, created_at, department_id, departments(name), onboarding_submissions(id, status, created_at, updated_at, review_note, agreement_version_id, agreement_content_sha256, agreement_accepted_at)")
    .not("status", "in", "(revoked,expired)")
    .order("created_at", { ascending: false });
  if (!isProgrammeWideRole(profile.role)) {
    query = query.eq("department_id", requireDepartmentScope(profile, profile.department_id));
  }
  const { data, error } = await query;
  if (error) throw new DataAccessError("Unable to load onboarding submissions.", 500);
  return (data ?? []).map((row) => {
    const submission = Array.isArray(row.onboarding_submissions)
      ? row.onboarding_submissions[0]
      : row.onboarding_submissions;
    const onboardingStatus = submission?.status === "draft"
      ? "in_progress"
      : submission?.status ?? (row.status === "onboarding_started" ? "in_progress" : "not_started");
    return {
    // Keep the invitation id as the stable list key. submissionId is nullable for
    // not-started interns and is the only id accepted by review/detail endpoints.
    id: row.id,
    submissionId: submission?.id ?? null,
    firstName: row.first_name,
    surname: row.surname,
    email: row.email,
    roleTitle: row.role_title,
    status: onboardingStatus,
    submittedAt: submission?.created_at ?? row.created_at,
    updatedAt: submission?.updated_at ?? row.created_at,
    reviewNote: submission?.review_note ?? null,
    agreementStatus:
      submission?.agreement_version_id && submission?.agreement_accepted_at && typeof submission?.agreement_content_sha256 === "string" && /^[a-f0-9]{64}$/i.test(submission.agreement_content_sha256)
        ? "completed"
        : "pending",
    department:
      (Array.isArray(row.departments) ? row.departments[0]?.name : (row.departments as { name?: string } | null)?.name) ??
      "Unavailable",
    };
  });
}

export async function getReviewSubmission(profile: TrustedProfile, submissionId: string) {
  const rows = await listReviewSubmissions(profile);
  const summary = rows.find((row) => row.submissionId === submissionId);
  if (!summary) throw new DataAccessError("Onboarding submission not found.", 404);
  const db = privilegedDatabase();
  const { data: documents } = await db
    .from("onboarding_documents")
    .select("id, kind, original_filename, byte_size, storage_path, malware_scan_status, available_at")
    .eq("onboarding_submission_id", submissionId)
    .is("deleted_at", null);
  const { data: bank } = await db
    .from("onboarding_bank_details")
    .select("account_number_last4")
    .eq("onboarding_submission_id", submissionId)
    .maybeSingle();
  return {
    ...summary,
    accountLast4: bank?.account_number_last4 ?? null,
    documents: (documents ?? []).map((doc) => ({
      id: doc.id,
      kind: doc.kind,
      filename: doc.original_filename,
      byteSize: doc.byte_size,
    })),
    agreementStatus: summary.agreementStatus,
  };
}

export async function reviewSubmission(profile: TrustedProfile, submissionId: string, decision: unknown, note: unknown) {
  const { error } = await privilegedDatabase().rpc("review_onboarding", {
    p_actor_profile_id: profile.id,
    p_submission_id: submissionId,
    p_decision: typeof decision === "string" ? decision : "",
    p_note: typeof note === "string" ? note : "",
  });
  if (error) throwOnboardingError(error);
}

export async function internDocumentAccess(profile: TrustedProfile, kind: DocumentKind) {
  const current = await getInternOnboarding(profile);
  if (!current.submission?.id) throw new DataAccessError("The document is unavailable.", 404);
  const { data } = await privilegedDatabase()
    .from("onboarding_documents")
    .select("id")
    .eq("onboarding_submission_id", current.submission.id)
    .eq("kind", kind)
    .is("deleted_at", null)
    .eq("malware_scan_status", "clean")
    .not("available_at", "is", null)
    .maybeSingle();
  if (!data?.id) throw new DataAccessError("The document is unavailable.", 404);
  return signedDocumentUrl(data.id, current.submission.id);
}

export async function reviewerDocumentAccess(profile: TrustedProfile, documentId: string) {
  const { data, error } = await privilegedDatabase()
    .from("onboarding_documents")
    .select("id, storage_path, onboarding_submission_id, deleted_at, malware_scan_status, available_at")
    .eq("id", documentId)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.deleted_at ||
    data.malware_scan_status !== "clean" ||
    !data.available_at
  ) throw new DataAccessError("The document is unavailable.", 404);
  await getReviewSubmission(profile, data.onboarding_submission_id);
  return signedDocumentUrl(data.id, data.onboarding_submission_id);
}
