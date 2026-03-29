import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenX — The Gen-Z Social Universe",
  description: "Where connections ignite. Share, chat, play, and watch together on the ultimate Gen-Z social platform.",
  keywords: "social media, gen-z, chat, video call, watch party, games, community",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
