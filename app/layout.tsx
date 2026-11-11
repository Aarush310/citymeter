import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "CityMeter: let your AI agent book the city",
  description:
    "Tennis courts, EV chargers, library rooms and parking. One HTTP request, deposit paid with MPP, booking confirmed in about a second.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#050505" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="nav">
          <div className="wrap">
            <a className="logo" href="/">
              <span className="logo-mark">C</span>
              CityMeter
            </a>
            <nav className="nav-links">
              <a href="/#problem">Problem</a>
              <a href="/#how">How it works</a>
              <a href="/#live">Live</a>
              <a href="/#try">Try it</a>
              <a href="/openapi.json">API</a>
            </nav>
            <a className="btn btn-green btn-sm" href="/#try">
              Book with your agent →
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
