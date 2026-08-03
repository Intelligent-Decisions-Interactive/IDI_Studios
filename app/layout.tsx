import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://idistudios.io"),
  title: "IDI Studios — Worlds Worth Mastering",
  description:
    "IDI Studios is the independent game studio behind Conquest: Ascension—a persistent fantasy strategy RPG built for thoughtful players.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "IDI Studios — Worlds Worth Mastering",
    description: "Independent game studio behind Conquest: Ascension.",
    type: "website",
    url: "https://idistudios.io",
    siteName: "IDI Studios",
    images: [
      {
        url: "/og-v2.png",
        width: 1536,
        height: 1024,
        alt: "IDI Studios — Worlds Worth Mastering",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IDI Studios — Worlds Worth Mastering",
    description: "Independent game studio behind Conquest: Ascension.",
    images: ["/og-v2.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
