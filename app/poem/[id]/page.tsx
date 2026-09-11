"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { poems } from "@/data/poems";
import { getProgress, getAccuracy } from "@/lib/progress";
import type { PoemProgress } from "@/types/poem";

export default function PoemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const poem = poems.find((p) => p.id === Number(id));
  const [progress, setProgress] = useState<PoemProgress | undefined>(undefined);
  const [hasImage, setHasImage] = useState(true);

  useEffect(() => {
    const all = getProgress();
    setProgress(all[Number(id)]);
  }, [id]);

  if (!poem) {
    return <div className="text-center py-20 text-stone-400">歌が見つかりません</div>;
  }

  const accuracy = getAccuracy(progress);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button
        onClick={() => router.back()}
        className="text-sm text-purple-700 hover:underline"
      >
        ← 戻る
      </button>

      <div className="relative">
      {poem.id > 1 && (
        <Link
          href={`/poem/${poem.id - 1}`}
          className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-white border-2 border-purple-200 rounded-2xl px-4 py-5 shadow-md hover:bg-purple-50 hover:border-purple-400 transition-colors text-purple-500 hover:text-purple-700"
        >
          <span className="text-3xl font-light">‹</span>
          <span className="text-xs font-medium">{poem.id - 1}番</span>
        </Link>
      )}
      {poem.id < poems.length && (
        <Link
          href={`/poem/${poem.id + 1}`}
          className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-white border-2 border-purple-200 rounded-2xl px-4 py-5 shadow-md hover:bg-purple-50 hover:border-purple-400 transition-colors text-purple-500 hover:text-purple-700"
        >
          <span className="text-3xl font-light">›</span>
          <span className="text-xs font-medium">{poem.id + 1}番</span>
        </Link>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
        <div className="flex">

          {/* 左：画像 */}
          {hasImage && (
            <div className="w-1/2 flex-shrink-0">
              <img
                key={poem.id}
                src={`/images/poems/poem-${poem.id}.jpg`}
                alt={poem.kamiNoKu}
                onError={() => setHasImage(false)}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 右：内容 */}
          <div className={`relative flex flex-col p-6 pb-16 space-y-4 ${hasImage ? "w-1/2" : "w-full"}`}>
            <div className="space-y-4">
              <span className="text-xs font-mono text-purple-500 font-bold">#{poem.id}</span>

              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-4 space-y-1 text-center">
                <p className="text-base text-purple-800 font-medium leading-relaxed">{poem.kamiNoKu}</p>
                <p className="text-base text-purple-900 font-bold leading-relaxed">{poem.shimoNoKu}</p>
                <p className="text-xs text-stone-400 pt-1">— {poem.author}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-stone-400 mb-1">読み</p>
                  <p className="text-sm text-stone-600 leading-relaxed">{poem.reading}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-1">現代語訳</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{poem.translation}</p>
                </div>
              </div>

              {progress && progress.correctCount + progress.incorrectCount > 0 && (
                <div className="border-t border-stone-100 pt-3 flex gap-4 text-xs text-stone-400">
                  <span>正解 {progress.correctCount}</span>
                  <span>不正解 {progress.incorrectCount}</span>
                  <span>正答率 {accuracy}%</span>
                  <span>連続正解 {progress.streak}</span>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
