import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canopy: Research Project Management",
  description:
    "A research project management and researcher well-being platform for academic research teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} data-theme="light">
      <head>
        {/* Synchronously apply stored theme before first paint. Default is light; only override if user explicitly chose dark or system. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('canopy-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');else if(t==='system')document.documentElement.removeAttribute('data-theme');}catch(e){}})();` }} />
      </head>
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
