import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "百人一首 学習サイト",
  description: "クイズ形式で百人一首を楽しく学ぼう",
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
        <Navigation />
        <main className="max-w-4xl w-full mx-auto px-4 py-4 flex-1 min-h-0 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
