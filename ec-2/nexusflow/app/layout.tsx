import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "NexusFlow",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
