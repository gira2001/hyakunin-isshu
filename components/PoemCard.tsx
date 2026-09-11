import Link from "next/link";
import type { Poem, PoemProgress } from "@/types/poem";
import { getAccuracy } from "@/lib/progress";

interface Props {
  poem: Poem;
  progress?: PoemProgress;
  expanded?: boolean;
  onClick?: () => void;
}

export default function PoemCard({ poem, progress, expanded = false, onClick }: Props) {
  const accuracy = getAccuracy(progress);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-purple-100 p-4 transition-all ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-purple-300" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-purple-500 font-bold">#{poem.id}</span>
      </div>

      <p className="text-sm text-purple-800 font-bold leading-relaxed mb-1">{poem.kamiNoKu}</p>
      <p className="text-sm text-purple-900 font-bold leading-relaxed mb-2">{poem.shimoNoKu}</p>
      <p className="text-xs text-stone-500 mb-2">— {poem.author}</p>
      <div className="text-right">
        <Link
          href={`/poem/${poem.id}`}
          onClick={e => e.stopPropagation()}
          className="text-sm text-purple-700 font-medium hover:underline"
        >
          詳細を見る →
        </Link>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-purple-100">
          <p className="text-xs text-stone-400 mb-1">読み</p>
          <p className="text-sm text-stone-600 mb-3 leading-relaxed">{poem.reading}</p>
          <p className="text-xs text-stone-400 mb-1">現代語訳</p>
          <p className="text-sm text-stone-700 leading-relaxed">{poem.translation}</p>
          {progress && progress.correctCount + progress.incorrectCount > 0 && (
            <div className="mt-3 flex gap-4 text-xs text-stone-400">
              <span>正解 {progress.correctCount}</span>
              <span>不正解 {progress.incorrectCount}</span>
              <span>正答率 {accuracy}%</span>
              <span>連続正解 {progress.streak}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
