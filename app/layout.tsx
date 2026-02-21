import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Messenger - Общайся в реальном времени",
  description: "Современный мессенджер с поддержкой личных и групповых чатов",
  icons: {
    icon: [
      { url: '/favicon.ico' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%23667eea;stop-opacity:1' /><stop offset='100%' style='stop-color:%23764ba2;stop-opacity:1' /></linearGradient></defs><rect width='100' height='100' rx='25' fill='url(%23grad)'/><path d='M30 35 Q30 25 40 25 L60 25 Q70 25 70 35 L70 55 Q70 65 60 65 L45 65 L30 75 L30 35 Z' fill='white' stroke='white' stroke-width='3'/></svg>" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
