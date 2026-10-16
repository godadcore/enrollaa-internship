import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-enrollaa-navy text-white px-4 py-16">
      <div className="mx-auto max-w-lg space-y-4 glass-card p-6">
        <h1 className="font-heading text-2xl font-bold">Invitation required</h1>
        <p className="text-sm text-enrollaa-muted-light">
          Programme accounts are created only through a trusted invitation. Open the private link from your invitation email, or paste the invitation token on the activation page.
        </p>
        <Link href="/onboarding" className="btn-primary inline-flex">
          Continue with an invitation token
        </Link>
      </div>
    </main>
  );
}
