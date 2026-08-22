import type { Metadata, Viewport } from "next";

// /me is Okamoto's private tracker: never indexed, never linked from the
// marketing site, and given its own PWA identity so "add to home screen"
// installs THIS app (name/icon/standalone) rather than the LP.
export const metadata: Metadata = {
  title: "85点の毎日",
  robots: { index: false, follow: false, nocache: true },
  manifest: "/me/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "85点",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/me-icon.png", icon: "/me-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F6" },
    { media: "(prefers-color-scheme: dark)", color: "#16181B" },
  ],
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
