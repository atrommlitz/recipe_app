import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google"

import { SiteHeader } from "@/components/SiteHeader"
import { RegisterSW } from "@/components/RegisterSW"
import { createClient } from "@/lib/supabase/server"

import "./globals.css"

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
})

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "Index", template: "%s · Index" },
  description: "Our recipes, in one place.",
  applicationName: "Index",
  appleWebApp: {
    capable: true,
    title: "Index",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e6db" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${sourceSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {user ? <SiteHeader email={user.email ?? ""} /> : null}
        <main className="flex-1">{children}</main>
        <RegisterSW />
      </body>
    </html>
  )
}
