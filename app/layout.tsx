import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Messenger - Общайся в реальном времени",
  description: "Современный мессенджер с поддержкой личных и групповых чатов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%2318181b'/><stop offset='100%25' stop-color='%2309090b'/></linearGradient><linearGradient id='f' x1='20' y1='38' x2='70' y2='86' gradientUnits='userSpaceOnUse'><stop offset='0%25' stop-color='%23818cf8'/><stop offset='100%25' stop-color='%234f46e5'/></linearGradient><linearGradient id='b' x1='36' y1='20' x2='82' y2='62' gradientUnits='userSpaceOnUse'><stop offset='0%25' stop-color='%233f3f46'/><stop offset='100%25' stop-color='%2318181b'/></linearGradient></defs><rect width='100' height='100' rx='24' fill='url(%23bg)'/><rect x='0.5' y='0.5' width='99' height='99' rx='23.5' fill='none' stroke='%2327272a' stroke-width='1'/><g><rect x='36' y='20' width='46' height='34' rx='14' fill='url(%23b)'/><path d='M 60 40 L 84 62 L 70 52 Z' fill='url(%23b)'/></g><g><rect x='20' y='40' width='50' height='38' rx='16' fill='url(%23f)'/><path d='M 35 60 L 14 86 L 45 76 Z' fill='url(%23f)'/></g><circle cx='33' cy='59' r='3.5' fill='white'/><circle cx='45' cy='59' r='3.5' fill='white' opacity='0.75'/><circle cx='57' cy='59' r='3.5' fill='white' opacity='0.4'/></svg>" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
