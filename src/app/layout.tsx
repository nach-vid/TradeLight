
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'TradeLight',
  description: 'Log your trades and journal your journey to trading mastery.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>
          {`
            html {
              zoom: 1.1;
            }
          `}
        </style>
      </head>
      <body className="font-headline antialiased bg-background text-foreground">
        <div className="content-wrapper min-h-screen">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
