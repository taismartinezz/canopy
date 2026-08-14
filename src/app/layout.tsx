import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canopy: Research Project Management",
  description:
    "A research project management and researcher well-being platform for academic research teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        {/* Synchronously apply stored theme before first paint so login and other pre-auth pages don't flash wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('canopy-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');else if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();` }} />
      </head>
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
