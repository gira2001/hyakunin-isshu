"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { QuizQuestion } from "@/types/poem";

interface Props {
  question: QuizQuestion;
  onAnswer: (correct: boolean, revealedAt: number) => void;
  voice?: SpeechSynthesisVoice | null;
  skipSpeech?: boolean;
}

const CHAR_MS = 90; // 句内の1文字あたりの表示間隔

// 歴史的仮名遣い → 現代語読みに変換
function toModernPronunciation(kana: string): string {
  return kana
    .replace(/てふ/g, 'ちょう')          // てふ → ちょう（特殊縮約）
    .replace(/ゐ/g, 'い')
    .replace(/ゑ/g, 'え')
    .replace(/ぢ/g, 'じ')
    .replace(/づ/g, 'ず')
    // は行転呼（語中・語末: 仮名の直後のみ適用）
    .replace(/([ぁ-ゖ])ひ/g, '$1い')
    .replace(/([ぁ-ゖ])ふ(?![ぁ-ゖ])/g, '$1う') // 語末のみ（ふける・ふりなど語頭は除外）
    .replace(/([ぁ-ゖ])へ/g, '$1え')
    .replace(/([ぁ-ゖ])ほ/g, '$1お')
    .replace(/([ぁ-ゖ])は/g, '$1わ');
}

export default function KarutaCard({ question, onAnswer, voice, skipSpeech = false }: Props) {
  const { poem, options, correctIndex } = question;
  const displayPhrases = poem.kamiNoKu.split(/\s+/).filter(Boolean);
  const readingPhrases = poem.reading.split(/\s+/).slice(0, 3).map(toModernPronunciation);
  const total = displayPhrases.reduce((s, p) => s + p.length, 0);

  const [revealedCount, setRevealedCount] = useState(skipSpeech ? total : 0);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef(false);
  const revealedRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (skipSpeech) return;
    const timers = timersRef.current;

    function clearAll() {
      timers.forEach(clearTimeout);
      timers.length = 0;
    }

    function revealPhrase(phraseIdx: number) {
      if (selectedRef.current || phraseIdx >= displayPhrases.length) return;
      const offset = displayPhrases.slice(0, phraseIdx).reduce((s, p) => s + p.length, 0);
      displayPhrases[phraseIdx].split("").forEach((_, i) => {
        timers.push(setTimeout(() => {
          if (selectedRef.current) return;
          const next = offset + i + 1;
          revealedRef.current = Math.max(revealedRef.current, next);
          setRevealedCount(prev => Math.max(prev, next));
        }, i * CHAR_MS));
      });
    }

    // 句ごとに別utteranceに分けて間（ま）を作る
    function speakChain(idx: number) {
      if (selectedRef.current || idx >= readingPhrases.length) return;

      const u = new SpeechSynthesisUtterance(readingPhrases[idx]);
      u.lang = "ja-JP";
      u.rate = 0.65;
      if (voice) u.voice = voice;

      u.onstart = () => revealPhrase(idx);

      u.onend = () => {
        if (idx < readingPhrases.length - 1) {
          // 句の間に750msのポーズ
          timers.push(setTimeout(() => speakChain(idx + 1), 750));
        } else {
          // 最終句終了後、未表示の文字を表示
          timers.push(setTimeout(() => {
            revealedRef.current = total;
            setRevealedCount(total);
          }, CHAR_MS * displayPhrases[idx].length));
        }
      };

      window.speechSynthesis.speak(u);
    }

    window.speechSynthesis.cancel();
    speakChain(0);

    return () => {
      window.speechSynthesis.cancel();
      clearAll();
    };
  }, [poem.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(index: number) {
    if (selectedRef.current) return;
    selectedRef.current = true;
    window.speechSynthesis.cancel();
    timersRef.current.forEach(clearTimeout);
    const correct = index === correctIndex;
    setSelected(index);
    onAnswer(correct, revealedRef.current);
  }

  function buttonStyle(): string {
    const base =
      "w-full text-left px-5 py-4 rounded-xl border-2 text-base leading-snug font-medium transition-all ";
    return selected === null
      ? base + "border-stone-200 bg-white hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
      : base + "border-stone-200 bg-white cursor-default";
  }

  return (
    <div className="space-y-3">
      {/* 上の句 文字表示エリア */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl px-6 py-4 shadow-sm">
        <p className="text-xs text-purple-400 tracking-widest uppercase mb-3">上の句</p>

        <div className="text-center leading-normal min-h-10 text-purple-900">
          {displayPhrases.map((phrase, phraseIdx) => {
            const offset = displayPhrases.slice(0, phraseIdx).reduce((s, p) => s + p.length, 0);
            return (
              <span key={phraseIdx} className="inline">
                {phraseIdx > 0 && <span className="inline-block w-5" aria-hidden="true" />}
                {phrase.split("").map((char, charIdx) => (
                  <span
                    key={charIdx}
                    className={`text-2xl font-bold inline-block ${
                      offset + charIdx < revealedCount ? "char-revealed" : "opacity-0"
                    }`}
                  >
                    {char}
                  </span>
                ))}
              </span>
            );
          })}
        </div>

      </div>

      {/* 選択肢 */}
      <div className="space-y-2 mt-4">
        {options.map((option, i) => (
          <button key={i} onClick={() => handleSelect(i)} className={buttonStyle()}>
            <span className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <span className="w-4 text-center shrink-0">
                  {selected !== null && i === correctIndex && <span className="text-emerald-600 font-bold">✓</span>}
                  {selected !== null && i === selected && i !== correctIndex && <span className="text-red-500 font-bold">✗</span>}
                </span>
                {option}
              </span>
              {selected !== null && i === selected && (
                <span className={`text-sm font-bold shrink-0 ${i === correctIndex ? "text-emerald-600" : "text-red-500"}`}>
                  {i === correctIndex ? "正解！" : "不正解"}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <div className="text-right px-1">
          <Link href={`/poem/${poem.id}`} className="text-sm text-purple-700 font-medium hover:underline">
            詳細を見る →
          </Link>
        </div>
      )}
    </div>
  );
}
