# Enrollaa Internship — controlled pilot (M8)

Do not contact real candidates or send invitations until explicit approval.

## Intended first group

Approximately 3–5 interns and 1–2 staff.

Suggested assignments (job category is **not** an account permission):

| Participant | Account role | Internship role | Department |
|---|---|---|---|
| Intern A | intern | Frontend Developer | Frontend Engineering |
| Intern B | intern | Backend Developer | Backend Engineering (activate only if that department is in use) |
| Intern C | intern | UI/UX Designer | UI/UX Design |
| Intern D (optional) | intern | Data Researcher | Product Research & Strategy |
| Intern E (optional) | intern | Graphic Designer | Content & Operations |
| Staff 1 | admin or super_admin | staff title | programme-wide |
| Staff 2 | lead | Department Lead | same department as Intern A |

Local automated tests must keep using labelled `@example.com` accounts. Do not treat existing local profiles as disposable.

## End-to-end checklist

1. Authorized staff creates an invitation with an official internship role.
2. Candidate receives the unique onboarding link (production email only after approval).
3. Candidate completes onboarding and uploads documents.
4. Reviewer approves or requests correction.
5. Intern signs in on their own device.
6. Intern checks in and out.
7. Staff assigns a task; intern submits; staff reviews.
8. Announcement reaches the intended audience; intern can mark notifications read.
9. Lead saves and submits a weekly report; admin reviews it.
10. Admin can open audit records for those mutations.
11. Refresh and a new session still show the same records.
12. Interns report issues to the named staff contact (email or Slack), not a new product.

## Daily staff checks

- Attendance recorded for expected interns
- Overdue tasks
- Unread onboarding submissions
- Failed invitation deliveries (status is not “sent” if email failed)

## Pause conditions

Pause the pilot if any of the following is confirmed:

- Cross-department or cross-user data exposure
- Private document URL usable by an unauthorized account
- Role escalation from client-supplied fields
- Duplicate attendance or task records that corrupt history
- Real email sent to the wrong person

Pause actions: stop invitation sending, ask participants not to upload further documents, capture time and actor (no tokens or signed URLs in notes), and restore from backup only if data integrity is lost.

## Conditions before real invitations

- Critical authorization checks pass
- Intern and staff core workflows verified in a browser
- Production `APP_URL`, Supabase, storage, and Resend configured
- `SKIP_EMAIL_DISPATCH` unset
- Named operator available to pause the pilot
