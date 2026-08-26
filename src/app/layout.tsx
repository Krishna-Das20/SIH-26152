import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NEXUS • Social Intelligence Platform",
  description: "AI-Driven Social Media Analytics — Narrative Mutation, Sentiment, Trends, Network Topology",
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
