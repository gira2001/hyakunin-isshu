import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "百人一首 学習サイト",
  description: "クイズ形式で百人一首を楽しく学ぼう。上の句の読み上げに合わせて下の句を選ぶかるた形式で、100首を楽しみながら覚えられます。友達との対戦モードも搭載。",
  metadataBase: new URL("https://hyakunin-isshu-silk.vercel.app"),
  verification: { google: "7I-T_gAnmRzgomZpudkdKIWPQZYV_HHayIiC6VWwOoY" },
  openGraph: {
    title: "百人一首 学習サイト",
    description: "クイズ形式で百人一首を楽しく学ぼう",
    url: "https://hyakunin-isshu-silk.vercel.app",
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body
        className={`${notoSerifJP.className} h-dvh flex flex-col`}
        style={{
          backgroundImage: "url('/images/tatami/tatami1.webp')",
          backgroundSize: "cover",
          backgroundAttachment: "fixed",
        }}
      >
        <ServiceWorkerRegister />
        <Navigation />
        <main className="max-w-4xl w-full mx-auto px-4 py-4 flex-1 min-h-0 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
