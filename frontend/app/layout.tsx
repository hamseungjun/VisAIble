import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VisAible',
  description: 'Neural architecture builder UI',
  icons: {
    icon: '/visaible-favicon-square.png',
    shortcut: '/visaible-favicon-square.png',
    apple: '/visaible-favicon-square.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen bg-hero-fade font-body text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
