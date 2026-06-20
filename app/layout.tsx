import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Country Day Camp Swim Portal",
  description:
    "Swim lesson schedules for Rolling Hills Country Day School Summer Camp instructors.",
  icons: {
    icon: "/camp-logo.png",
    apple: "/camp-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Pacifico&family=Nunito:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
