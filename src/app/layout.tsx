import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "HTGether — Plateforme de pentest collaboratif",
  description: "Plateforme collaborative de gestion d'audits de sécurité",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      data-accent="amber"
      data-signature="rulers"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var el = document.documentElement;
                  var accent = localStorage.getItem('htg-accent') || 'amber';
                  var sig = localStorage.getItem('htg-signature') || 'rulers';
                  if (['amber','cyan','indigo'].indexOf(accent) >= 0) el.setAttribute('data-accent', accent);
                  if (['rulers','ticks','mono','rails','none'].indexOf(sig) >= 0) el.setAttribute('data-signature', sig);
                  el.classList.add('dark');
                  el.setAttribute('data-theme', 'dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
