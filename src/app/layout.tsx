import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/providers/AuthProvider";
import ToastContainer from "@/components/ui/ToastContainer";
import LayoutWrapper from "@/providers/LayoutWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

/* The name on the browser tab and its hover card. Without a title the
   browser falls back to the page's address, which put the full URL of
   whatever screen was open on show. */
export const metadata: Metadata = {
  title: "Synergy Sync",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storage = localStorage.getItem('ui-storage');
                  var theme = 'light';
                  if (storage) {
                    var parsed = JSON.parse(storage);
                    if (parsed && parsed.state && parsed.state.theme) {
                      theme = parsed.state.theme;
                    }
                  } else {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-slate-50 dark:bg-[#030d16] text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-300">
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}