import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const terminal = JetBrains_Mono({
  variable: "--font-terminal",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

const SITE = "https://vidojo.vercel.app";

const TITLE = "vidojo";
const TAGLINE = "Learn vi by actually using it";
const BLURB =
  "A simulated Linux box with a real C++ codebase to open, navigate and edit. Every motion, operator and text object, in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${TITLE} · ${TAGLINE}`,
    template: `%s · ${TITLE}`,
  },
  description: BLURB,
  applicationName: TITLE,
  keywords: [
    "vi",
    "vim",
    "vi tutorial",
    "learn vim",
    "terminal simulator",
    "linux terminal",
    "modal editing",
    "cpp",
  ],
  authors: [{ name: "sami5436", url: "https://github.com/sami5436" }],
  creator: "sami5436",
  // iMessage, Slack, Discord and friends all read these Open Graph tags
  openGraph: {
    type: "website",
    url: SITE,
    siteName: TITLE,
    title: `${TITLE} · ${TAGLINE}`,
    description: BLURB,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · ${TAGLINE}`,
    description: BLURB,
  },
  appleWebApp: {
    capable: true,
    title: TITLE,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
  ],
};

// Resolve the stored theme before first paint so the terminal never flashes white.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("vidojo:theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className={terminal.variable}>{children}</body>
    </html>
  );
}
