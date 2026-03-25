import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Dashboard Neon | Analisador",
  description: "Analisador moderno de comentários do Instagram com IA e Scraping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${outfit.variable} font-sans min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground antialiased relative overflow-x-hidden`}>
        {/* Elementos de background dinâmico Neon/Glassmorphism */}
        <div className="fixed top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-primary/20 blur-[120px] mix-blend-screen animate-blob z-[-1]" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50rem] h-[50rem] rounded-full bg-secondary/20 blur-[150px] mix-blend-screen animate-blob-slow z-[-1]" />
        <div className="fixed top-[40%] left-[30%] w-[30rem] h-[30rem] rounded-full bg-accent/20 blur-[100px] mix-blend-screen animate-blob z-[-1]" style={{ animationDelay: '2s' }} />
        
        {/* Noise overlay opcional para textura */}
        <div className="fixed inset-0 z-[-1] opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/noise-pattern-with-subtle-cross-lines.png")' }} />
        
        {children}
      </body>
    </html>
  );
}
