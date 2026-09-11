"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { HyakuninQuestion } from "@/types/poem";

const CHAR_MS = 90;

function toModernPronunciation(kana: string): string {
  return kana
    .replace(/てふ/g, "ちょう")
    .replace(/ゐ/g, "い")
    .replace(/ゑ/g, "え")
    .replace(/ぢ/g, "じ")
    .replace(/づ/g, "ず")
    .replace(/([ぁ-ゖ])ひ/g, "$1い")
    .replace(/([ぁ-ゖ])ふ(?![ぁ-ゖ])/g, "$1う")
    .replace(/([ぁ-ゖ])へ/g, "$1え")
    .replace(/([ぁ-ゖ])ほ/g, "$1お")
    .replace(/([ぁ-ゖ])は/g, "$1わ");
}

interface Props {
  question: HyakuninQuestion;
  onAnswer: (correct: boolean) => void;
  voice?: SpeechSynthesisVoice | null;
  skipSpeech?: boolean;
}

export default function HyakuninBoard({ question, onAnswer, voice, skipSpeech = false }: Props) {
  const { poem, options, correctIndex } = question;
  const displayPhrases = poem.kamiNoKu.split(/\s+/).filter(Boolean);
  const readingPhrases = poem.reading.split(/\s+/).slice(0, 3).map(toModernPronunciation);
  const total = displayPhrases.reduce((s, p) => s + p.length, 0);

  const [revealedCount, setRevealedCount] = useState(skipSpeech ? total : 0);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef(false);
  const revealedRef = useRef(skipSpeech ? total : 0);
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
        timers.push(
          setTimeout(() => {
            if (selectedRef.current) return;
            const next = offset + i + 1;
            revealedRef.current = Math.max(revealedRef.current, next);
            setRevealedCount((prev) => Math.max(prev, next));
          }, i * CHAR_MS)
        );
      });
    }

    function speakChain(idx: number) {
      if (selectedRef.current || idx >= readingPhrases.length) return;
      const u = new SpeechSynthesisUtterance(readingPhrases[idx]);
      u.lang = "ja-JP";
      u.rate = 0.65;
      if (voice) u.voice = voice;
      u.onstart = () => revealPhrase(idx);
      u.onend = () => {
        if (idx < readingPhrases.length - 1) {
          timers.push(setTimeout(() => speakChain(idx + 1), 750));
        } else {
          timers.push(
            setTimeout(() => {
              revealedRef.current = total;
              setRevealedCount(total);
            }, CHAR_MS * displayPhrases[idx].length)
          );
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

  function playSound(correct: boolean) {
    const ctx = new AudioContext();
    if (correct) {
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.value = 120;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  }

  function handleSelect(index: number) {
    if (selectedRef.current) return;
    selectedRef.current = true;
    window.speechSynthesis.cancel();
    timersRef.current.forEach(clearTimeout);
    setSelected(index);
    playSound(index === correctIndex);
    onAnswer(index === correctIndex);
  }

  function torifudaWrapClass(i: number): string {
    const base = "relative flex-1 min-h-0 max-w-36 transition-all group ";
    if (selected === null) return base;
    if (i === correctIndex) return base + "ring-4 ring-emerald-500 rounded-sm";
    if (i === selected) return base + "ring-4 ring-red-500 rounded-sm opacity-90";
    return base + "opacity-30";
  }

  const topRow = options.slice(0, 2);
  const bottomRow = options.slice(2, 4);

  return (
    <div className="relative flex flex-col gap-2 h-full">

      {/* 上の句カード（大） */}
      <div className="flex-[2] min-h-0 flex justify-center">
        <div className="h-full bg-white border-4 border-green-700 flex flex-col items-center justify-center gap-2 px-6 pt-[clamp(0.5rem,3dvh,2rem)] pb-2 overflow-hidden">
          {/* 縦書き 5-7-5 */}
          <div className="flex flex-row-reverse gap-3">
            {displayPhrases.map((phrase, phraseIdx) => {
              const offset = displayPhrases.slice(0, phraseIdx).reduce((s, p) => s + p.length, 0);
              return (
                <div
                  key={phraseIdx}
                  style={{
                    writingMode: "vertical-rl",
                    fontSize: "clamp(1rem, 4dvh, 2.8rem)",
                    lineHeight: 1,
                  }}
                  className="text-stone-900 tracking-widest"
                >
                  {phrase.split("").map((char, charIdx) => (
                    <span
                      key={charIdx}
                      className={`transition-opacity duration-100 ${
                        offset + charIdx < revealedCount ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {char}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          {/* 作者 */}
          <p style={{ fontSize: "clamp(0.65rem, 1.5dvh, 1rem)" }} className="text-stone-500 tracking-wide">
            — {poem.author}
          </p>
        </div>
      </div>

      {/* 下の句カード（小）4+4 */}
      <div className="flex-[3] min-h-0 flex flex-col gap-6">
        {[topRow, bottomRow].map((row, rowIdx) => (
          <div key={rowIdx} className="flex-1 min-h-0 flex gap-6 justify-center">
            {row.map((option, colIdx) => {
              const i = rowIdx * 2 + colIdx;
              const r = option.readingShimo;
              const cols: string[] = [];
              for (let j = 0; j < r.length; j += 5) cols.push(r.slice(j, j + 5));

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={selected !== null}
                  className={torifudaWrapClass(i)}
                >
                  <div
                    className="w-full h-full bg-white border-4 border-green-700 transition-colors group-hover:bg-green-50 group-hover:border-green-600"
                    style={{ containerType: "size" }}
                  >
                    <div className="w-full flex flex-row-reverse h-full items-start justify-center pt-3">
                      {cols.map((col, ci) => (
                        <div
                          key={ci}
                          style={{
                            writingMode: "vertical-rl",
                            fontSize: "min(14cqh, calc(100cqw / 3))",
                            lineHeight: 1,
                          }}
                          className="text-stone-900 tracking-widest"
                        >
                          {col}
                        </div>
                      ))}
                    </div>
                  </div>
                  {selected !== null && i === correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-5xl font-bold text-emerald-500 drop-shadow-md">○</span>
                    </div>
                  )}
                  {selected !== null && i === selected && i !== correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-5xl font-bold text-red-500 drop-shadow-md">✕</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selected !== null && (
        <div className="absolute bottom-2 right-4">
          <Link href={`/poem/${poem.id}`} className="text-xs text-amber-100 font-medium hover:underline">
            詳細を見る →
          </Link>
        </div>
      )}
    </div>
  );
}
