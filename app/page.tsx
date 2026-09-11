import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-5xl font-bold text-purple-900 tracking-widest mb-4">百人一首</h1>
        <p className="text-stone-500 text-lg mb-2">小倉山荘</p>
        <p className="text-stone-600 max-w-xl mx-auto leading-relaxed">
          藤原定家が選んだ一百首の和歌。かるた形式で楽しみながら覚えましょう。
        </p>
      </section>

      {/* CTAボタン */}
      <section className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/hyakunin"
          className="bg-purple-700 text-white px-10 py-4 rounded-xl font-bold text-center text-lg hover:bg-purple-600 transition-colors shadow-lg"
        >
          百人一首を始める
        </Link>
        <Link
          href="/list"
          className="bg-white text-purple-800 border-2 border-purple-300 px-10 py-4 rounded-xl font-bold text-center text-lg hover:bg-purple-50 transition-colors"
        >
          一覧を見る
        </Link>
      </section>

      {/* 機能説明 */}
      <section className="grid sm:grid-cols-3 gap-6">
        {[
          {
            icon: "🎴",
            title: "百人一首モード",
            desc: "上の句が読み上げられ、とり札から下の句を選ぶ。間違えた歌は重点的に出題されます。",
            href: "/hyakunin",
          },
          {
            icon: "📖",
            title: "100首一覧",
            desc: "全首を一覧表示。作者・読み・現代語訳をまとめて確認できます。",
            href: "/list",
          },
          {
            icon: "📊",
            title: "進捗管理",
            desc: "正答率・習得数を記録。苦手な歌を把握して効率よく学習できます。",
            href: "/progress",
          },
        ].map((f) => (
          <Link key={f.title} href={f.href} className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center hover:bg-purple-50 hover:border-purple-300 transition-colors">
            <div className="text-4xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-purple-900 mb-2">{f.title}</h3>
            <p className="text-stone-500 text-sm leading-relaxed">{f.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
