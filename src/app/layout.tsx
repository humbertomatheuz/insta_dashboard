import type { Metadata } from "next";
import { Outfit, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Insta Dashboard | Análise de Comentários",
  description: "Extraia, filtre e analise comentários do Instagram com scroll infinito, paginação e exportação inteligente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${outfit.variable} font-sans min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground antialiased relative overflow-x-hidden`}>
        {/* Degrade estático escuro com cores do Instagram */}
        <div className="fixed inset-0 z-[-2] bg-black" />
        <div className="fixed top-[-20%] left-[-10%] w-[50rem] h-[50rem] rounded-full bg-[#bc1888]/5 blur-[150px] pointer-events-none z-[-1]" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[60rem] h-[60rem] rounded-full bg-[#f09433]/5 blur-[150px] pointer-events-none z-[-1]" />
        <div className="fixed top-[30%] left-[40%] w-[40rem] h-[40rem] rounded-full bg-[#dc2743]/5 blur-[150px] pointer-events-none z-[-1]" />
        
        {/* Noise overlay opcional para textura */}
        <div className="fixed inset-0 z-[-1] opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/noise-pattern-with-subtle-cross-lines.png")' }} />
        
        {children}
      </body>
    </html>
  );
}
