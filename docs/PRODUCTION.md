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

## 6. Blocked until approved

- Connecting to hosted Supabase
- Applying production migrations
- Sending real email
- Inviting real candidates
- Publishing DNS/hosting cutover
