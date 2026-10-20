import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lensi CRM",
  description: "Funil de vendas pelo WhatsApp com origem do tráfego",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
