import { UiText } from "@/components/UiText";

import { cookies } from "next/headers";
import LanguageProvider from "@/components/LanguageProvider";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import Header from "@/components/Header";
import BetaBanner from "@/components/BetaBanner";
import LanguageConverter from "@/components/LanguageConverter";

export const metadata: Metadata = {
  title: "慢递局",
  description: "给彼此的信，不着急。",
};

export const viewport: Viewport = {
  themeColor: "#F7F4EC",
};

const prefsInit = `try{
  var t=localStorage.getItem('mdj-theme')||'auto';
  var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark',d);
  var f=localStorage.getItem('mdj-font');
  if(f&&f!=='default')document.documentElement.setAttribute('data-font',f);
}catch(e){}`;

const swInit = `try{
  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    });
  }
}catch(e){}`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale =
    (await cookies()).get("mdj-language")?.value === "zh-Hant"
      ? "zh-Hant"
      : "zh-Hans";
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsInit }} />
        <script dangerouslySetInnerHTML={{ __html: swInit }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="慢递局" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="stylesheet" href="/fonts/noto-serif-sc/400.css" />
        <link rel="stylesheet" href="/fonts/noto-serif-sc/700.css" />
        <link rel="stylesheet" href="/fonts/noto-sans-sc/400.css" />
        <link rel="stylesheet" href="/fonts/noto-sans-sc/700.css" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/assets/logo/A0.png" />
        <link rel="apple-touch-icon" href="/assets/logo/A0.png" />
      </head>
      <body className="min-h-screen">
        <LanguageProvider initialLocale={locale}>
          <Header />
          <BetaBanner />
          <main className="mx-auto w-full px-4 pb-16 pt-6">
            <div className="page-width">{children}</div>
          </main>
          <footer className="border-t border-black/5 pb-8 pt-6 dark:border-white/10">
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-xs text-ink-soft">
              <Link href="/privacy" className="hover:text-ink">
                <UiText text={"隐私政策"} />
              </Link>
              <Link href="/download" className="hover:text-ink">
                <UiText text={"下载"} />
              </Link>
              <Link href="/about" className="hover:text-ink">
                <UiText text={"关于本站"} />
              </Link>
              <Link href="/rules" className="hover:text-ink">
                <UiText text={"社区规则"} />
              </Link>
              <Link href="/changelog" className="hover:text-ink">
                <UiText text={"更新日志"} />
              </Link>
              <a href="mailto:ycharsenal@163.com" className="hover:text-ink">
                <UiText text={"联系邮箱"} />
              </a>
            </div>
            <p className="mt-3 text-center text-[11px] text-ink-soft/70">
              <UiText text={"慢递局 · 给彼此的信，不着急"} />
            </p>
          </footer>
          <LanguageConverter />
        </LanguageProvider>
      </body>
    </html>
  );
}
