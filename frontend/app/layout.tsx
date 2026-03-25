import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'VisAIble',
  description: 'Neural architecture builder UI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-hero-fade font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
