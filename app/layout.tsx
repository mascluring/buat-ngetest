import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ERA SUPER LEAGUE — FPL Command Center',
  description: 'FPL Classic League Live Dashboard & Analytics',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
