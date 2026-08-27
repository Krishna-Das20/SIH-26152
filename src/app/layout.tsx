import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SKYNET • Social Intelligence Platform",
  description: "SKYNET Autonomous Social Media Intelligence & Narrative Tracking Platform — SIH-26152",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-nexus-bg text-nexus-text-primary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
