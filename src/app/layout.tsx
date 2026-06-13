import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Shapeshifter",
  description:
    "AI that tailors your resume to any job description in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
