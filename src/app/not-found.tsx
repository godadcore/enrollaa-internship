import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-enrollaa-navy text-white px-4 py-16 flex items-center justify-center">
      <div className="mx-auto max-w-lg space-y-4 glass-card p-6 min-w-0">
        <h1 className="font-heading text-2xl font-bold break-words">Page not found</h1>
        <p className="text-sm text-enrollaa-muted-light break-words">
          This address is not part of the Enrollaa internship portal. Return to sign-in to continue with an authorized account.
        </p>
        <Link href="/login" className="btn-primary inline-flex">
          Go to sign-in
        </Link>
      </div>
    </main>
  );
}
