// app/layout.js
import "./globals.css";

export const metadata = {
  title: "The Team Sheet — Daily Football Connections",
  description:
    "A new football connections puzzle every day. You're shown three players — name the one who played with all of them. Build a streak, share your result.",
  applicationName: "The Team Sheet",
  openGraph: {
    title: "The Team Sheet — Daily Football Connections",
    description: "Name the player who links all three. A new puzzle every day.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
