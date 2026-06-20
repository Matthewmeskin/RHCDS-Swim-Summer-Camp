import type { Metadata } from "next";
import { Pacifico, Nunito } from "next/font/google";
import "./globals.css";

// Self-hosted (no render-blocking request to Google Fonts), with swap.
const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pacifico",
  display: "swap",
});
const nunito = Nunito({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Country Day Camp Swim Portal",
  description:
    "Swim lesson schedules for Rolling Hills Country Day School Summer Camp instructors.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pacifico.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
