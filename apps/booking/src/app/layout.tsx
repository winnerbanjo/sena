import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Direct Reservation — Stay Connect Lekki',
  description: 'Book directly with Stay Connect Lekki. No booking fees.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7F1E8] text-[#191816] flex flex-col justify-between">
        {children}
      </body>
    </html>
  );
}
