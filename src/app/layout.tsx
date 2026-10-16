import type { Metadata, Viewport } from "next";
import "./globals.css";

const metadataBase = (() => {
  try {
    const configured = process.env.APP_URL?.trim();
    if (configured) return new URL(configured);
  } catch {
    /* use production origin */
  }
  return new URL("https://enrollaa.com.ng");
})();

export const metadata: Metadata = {
  metadataBase,
  title: "Enrollaa Internship Management System",
  description:
    "Production operational portal for managing the Enrollaa internship lifecycle — onboarding, attendance, tasks, and giveaways.",
  alternates: { canonical: "/" },
  keywords: [
    "Enrollaa",
    "internship",
    "management",
    "onboarding",
    "attendance",
    "task management",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/light%20mode%20app%20and%20share%20icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/light%20mode%20app%20and%20share%20icon.svg",
    apple: "/brand/Light%20mode%20App%20And%20Socials%20Icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F0040",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
