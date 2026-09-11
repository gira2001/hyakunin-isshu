"use client";

import { useEffect, useState } from "react";
import { poems } from "@/data/poems";
import { getProgress, clearProgress } from "@/lib/progress";
import PoemCard from "@/components/PoemCard";
import type { ProgressMap } from "@/types/poem";

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setProgress(getProgress());
  }, []);

  function handleReset() {
    clearProgress();
    setProgress({});
    setShowConfirm(false);
  }

  const allProgress = Object.values(progress);
  const totalAnswered = allProgress.reduce((s, p) => s + p.correctCount + p.incorrectCount, 0);
  const totalCorrect = allProgress.reduce((s, p) => s + p.correctCount, 0);

  const incorrectPoems = poems.filter((p) => {
    const pr = progress[p.id];
    return pr && pr.incorrectCount > 0;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-6 bg-white rounded-xl px-6 py-4 shadow-sm border border-purple-100">
        <div className="text-center">
          <p className="text-xs text-stone-400 mb-1">問題数</p>
          <p className="text-2xl font-bold text-purple-900">{totalAnswered}</p>
        </div>
        <div className="w-px bg-stone-100 self-stretch" />
        <div className="text-center">
          <p className="text-xs text-stone-400 mb-1">正答数</p>
          <p className="text-2xl font-bold text-emerald-600">{totalCorrect}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowConfirm(true)}
            className="text-xs px-3 py-1.5 rounded-lg text-red-400 border border-red-200 hover:bg-red-50 transition-colors"
          >
            学習記録を消去
          </button>
        </div>
      </div>

      {incorrectPoems.length === 0 ? (
        <p className="text-center text-stone-400 py-12">
          {totalAnswered === 0 ? "まだ回答していません" : "不正解の歌はありません"}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-400">{incorrectPoems.length}首が不正解</p>
          {incorrectPoems.map((poem) => (
            <PoemCard key={poem.id} poem={poem} progress={progress[poem.id]} />
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-6 mx-6 max-w-sm w-full space-y-4">
            <p className="font-bold text-stone-800 text-center">学習記録を消去しますか？</p>
            <p className="text-sm text-stone-500 text-center">正答数・不正解履歴がすべて削除されます。この操作は元に戻せません。</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                消去する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
