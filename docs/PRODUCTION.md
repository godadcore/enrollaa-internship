# Enrollaa Internship — production preparation (M7)

This is a procedure, not authorization to deploy. Do not apply migrations to hosted Supabase or send real invitations until those actions are explicitly approved.

Production origin: `https://enrollaa.com.ng`

## 1. Verified locally

- Invitation-only `/register`
- Server-side trusted identity and department scope
- Local migrations `202610150001` through `202610150010` (apply only to local Supabase)
- `npx tsc --noEmit` and `npx next build` after M6/M7 changes
- Email dispatch remains honest: skipped or unconfigured delivery is never marked sent
- Health endpoint: `GET /api/health` (no secrets)

## 2. Provision a separate production Supabase project

1. Create a new project. Do not reuse the local Docker instance or any waitlist project.
2. Record the project URL, publishable key, and service-role secret in the host’s **server** environment only.
3. Apply reviewed SQL migrations in filename order. **Do not apply `supabase/schema.sql`.**
4. Confirm RLS is enabled and `anon` / `authenticated` remain revoked on application tables.
5. Create private storage bucket `staff-onboarding` with no public listing. Signed URLs stay short-lived.
6. Auth URL allow-list:
   - Site URL: `https://enrollaa.com.ng`
   - Redirects: `https://enrollaa.com.ng/auth/callback`, `/login`, `/onboarding`, `/create-password`, `/reset-password`
7. Configure backups in the Supabase dashboard (PITR if available) and note the recovery window.

## 3. Hosting environment

Set on the host (names only; no real values here):

- `APP_URL=https://enrollaa.com.ng`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ONBOARDING_BANK_KEY` (recommended separate from the service role)
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_TIMEZONE=Africa/Lagos`

Must remain **unset** in production: `SKIP_EMAIL_DISPATCH`.

## 4. Email

- Verify `enrollaa.com.ng` (SPF, DKIM, DMARC) with Resend.
- Sender: internship mailbox on that domain.
- Invitation, create-password, and recovery links must use `APP_URL`.
- If Resend rejects a message, invitation status must stay undelivered.

## 5. Rollback

- Application: redeploy the previous Next.js release. Do not roll back database by dropping tables.
- Database: restore from backup; never reset or replay stale `schema.sql`.
- Pause invitations by stopping new sends in the admin UI and, if needed, rotating `RESEND_API_KEY`.

## 6. Malware scanning (required before document access)

- The application requires a private, authenticated scanner configured with `MALWARE_SCANNER_URL`, `MALWARE_SCANNER_TOKEN`, and optionally `MALWARE_SCANNER_TIMEOUT_MS`.
- The URL must be HTTPS in production. The service receives a POST of the file bytes with a Bearer token and must return JSON exactly containing `{"verdict":"clean"}` or `{"verdict":"infected"}`.
- Missing configuration, timeout, outage, non-JSON, unauthenticated, or ambiguous responses mark the document `failed` and leave it unavailable. Only an explicit `clean` verdict sets `available_at`.
- A local Docker service is now prepared under `scanner-service/`; it runs ClamAV with `freshclam` definitions and exposes the adapter-compatible contract. Netlify cannot provide a persistent ClamAV daemon, so deploy this service separately behind private networking and HTTPS before enabling production uploads.
- Set the scanner service's server-only `SCANNER_TOKEN`; set the same secret only in the application's server environment as `MALWARE_SCANNER_TOKEN`. Never expose either value to the browser or commit it.
- Verify safely with synthetic files (including the EICAR test signature in an isolated scanner environment), never real onboarding documents or a public upload service. No client-supplied verdict is trusted.

## 7. Invitation and document-link preparation

- Invitation creation and resend use the server-only Resend integration. Database RPCs enforce administrator authorization, active/expired/revoked status, duplicate-email protection, and resend restrictions. Delivery is recorded only after Resend returns HTTP success with a non-empty provider message ID.
- `RESEND_API_KEY` and `EMAIL_FROM` must be configured in the application host, with the sender domain verified by Resend. No real delivery has been tested from this local environment.
- The generic `/api/send-email` route remains disabled because it has no safe authorization or recipient contract.
- `202610150011_document_links_preparation.sql` is a local, unapplied preparation migration. It supports HTTPS links from the explicit provider categories `google_drive`, `dropbox`, and `onedrive`, and stores them as `unscanned`. The application must never fetch these URLs server-side or expose them as clean scanned documents.
- Do not apply this migration until the matching route/UI, host allow-list, reviewer authorization, and hosted schema plan have been reviewed.

## 8. Blocked until approved

- Connecting to hosted Supabase
- Applying production migrations
- Sending real email
- Inviting real candidates
- Publishing DNS/hosting cutover
