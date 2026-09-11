import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <h1 className="text-5xl font-bold text-purple-900 tracking-widest">百人一首</h1>
      <p className="text-stone-500 text-base">小倉山荘</p>
      <p className="text-stone-600 text-sm">クイズ形式で百人一首を楽しく学ぼう</p>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm sm:max-w-none sm:justify-center">
        <Link
          href="/hyakunin"
          className="bg-purple-700 text-white px-10 py-4 rounded-xl font-bold text-center text-lg hover:bg-purple-600 transition-colors shadow-lg"
        >
          百人一首
        </Link>
        <Link
          href="/battle"
          className="bg-white text-purple-800 border-2 border-purple-300 px-10 py-4 rounded-xl font-bold text-center text-lg hover:bg-purple-50 transition-colors shadow"
        >
          友達と対戦する
        </Link>
      </div>
    </div>
  );
}
