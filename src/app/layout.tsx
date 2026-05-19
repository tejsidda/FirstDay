import type { Metadata, Viewport } from "next";
<<<<<<< HEAD
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PullToRefresh from "@/components/PullToRefresh";
=======
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import NavigateBackListener from "@/components/NavigateBackListener";
>>>>>>> 5169cdb6fe86719acb4631b20c13950d4c5f1148

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FDFS",
  description: "My own Movie Log App. to track my favorite movies and TV shows.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${playfair.variable} antialiased`}
        style={{ background: "var(--background-base)" }}
      >
<<<<<<< HEAD
        <PullToRefresh />
=======
        <NavigateBackListener />
>>>>>>> 5169cdb6fe86719acb4631b20c13950d4c5f1148
        {children}
      </body>
    </html>
  );
}
