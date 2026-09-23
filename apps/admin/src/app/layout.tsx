import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Internal Admin — Sena Platform',
  description: 'Internal multi-property administration and system operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#191816]">
        {children}
      </body>
    </html>
  );
}
