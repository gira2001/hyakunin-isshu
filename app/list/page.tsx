"use client";

import { useState } from "react";
import { poems } from "@/data/poems";
import PoemCard from "@/components/PoemCard";

export default function ListPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = search
    ? poems.filter((poem) => {
        const q = search.toLowerCase();
        return (
          String(poem.id).includes(q) ||
          poem.kamiNoKu.includes(q) ||
          poem.shimoNoKu.includes(q) ||
          poem.author.includes(q) ||
          poem.reading.includes(q)
        );
      })
    : poems;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold text-purple-900">百人一首 一覧</h1>
        <span className="text-sm text-stone-400">{filtered.length} / {poems.length} 首</span>
      </div>

      <input
        type="text"
        placeholder="番号・歌・作者名で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">該当する歌がありません</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((poem) => (
            <PoemCard
              key={poem.id}
              poem={poem}
              expanded={expandedId === poem.id}
              onClick={() => setExpandedId(expandedId === poem.id ? null : poem.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
