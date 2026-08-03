import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://idistudios.io"),
  title: "IDI Studios — Games Built for Players Who Think",
  description:
    "IDI Studios creates deep, systems-driven games where preparation matters, progress is earned, and victory makes sense.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "IDI Studios — Games Built for Players Who Think",
    description:
      "Independent game studio behind Conquest: Ascension.",
    type: "website",
    url: "https://idistudios.io",
    siteName: "IDI Studios",
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "IDI Studios — Games Built for Players Who Think",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IDI Studios — Games Built for Players Who Think",
    description: "Independent game studio behind Conquest: Ascension.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
