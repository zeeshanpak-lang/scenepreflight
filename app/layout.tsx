import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://scene-preflight.zeshu090.chatgpt.site"),
  title: "ScenePreflight — protect continuity before generation",
  description:
    "An agent-native preflight board that catches costly AI-video continuity conflicts while keeping final approval with the creator.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "ScenePreflight",
    description:
      "Lock production truth, stage agent repairs, and protect scarce generation credits.",
    type: "website",
    images: ["/storyboard-strip.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
