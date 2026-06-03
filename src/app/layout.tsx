import type { Metadata } from "next";
import { Lora, Roboto } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "600", "700"],
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canopy — Research Project Management",
  description:
    "A research project management and researcher well-being platform for academic research teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${roboto.variable} h-full`}>
      <body className="h-full" style={{ fontFamily: "var(--font-roboto)" }}>
        {children}
      </body>
    </html>
  );
}
