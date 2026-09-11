"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { poems } from "@/data/poems";
import { generateQuestion } from "@/lib/quiz";
import { getProgress, updateProgress } from "@/lib/progress";
import KarutaCard from "@/components/KarutaCard";
import type { QuizQuestion } from "@/types/poem";

export default function KarutaPage() {
  const [question, setQuestion] = useState<QuizQuestion | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = sessionStorage.getItem("karuta_question");
    return saved ? JSON.parse(saved) : null;
  });
  const [answered, setAnswered] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("karuta_answered") === "true" : false
  );
  const [showPopup, setShowPopup] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(() =>
    typeof window !== "undefined" ? Number(sessionStorage.getItem("karuta_correct") ?? 0) : 0
  );
  const [sessionTotal, setSessionTotal] = useState(() =>
    typeof window !== "undefined" ? Number(sessionStorage.getItem("karuta_total") ?? 0) : 0
  );

  useEffect(() => { sessionStorage.setItem("karuta_correct", String(sessionCorrect)); }, [sessionCorrect]);
  useEffect(() => { sessionStorage.setItem("karuta_total", String(sessionTotal)); }, [sessionTotal]);
  useEffect(() => { if (question) sessionStorage.setItem("karuta_question", JSON.stringify(question)); }, [question]);
  useEffect(() => { sessionStorage.setItem("karuta_answered", String(answered)); }, [answered]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    function loadVoices() {
      const jaVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("ja"));
      setVoices(jaVoices);
      setSelectedVoice(prev => prev ?? jaVoices[0] ?? null);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const nextQuestion = useCallback(() => {
    const progress = getProgress();
    setQuestion(generateQuestion(poems, progress));
    setAnswered(false);
    setShowPopup(false);
  }, []);

  useEffect(() => {
    if (!question) nextQuestion();
  }, [nextQuestion, question]);

  function handleAnswer(correct: boolean, _revealedAt: number) {
    if (!question) return;
    updateProgress(question.poem.id, correct);
    setAnswered(true);
    setSessionTotal((t) => t + 1);
    if (correct) setSessionCorrect((c) => c + 1);
    setTimeout(() => setShowPopup(true), 800);
  }

  if (!question) {
    return <div className="text-center py-20 text-stone-400">読み込み中...</div>;
  }

  const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* ヘッダー */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-purple-900 tracking-widest">四択モード</h1>
      </div>

      {/* コントロールバー */}
      <div className="flex items-center justify-between bg-white rounded-xl px-5 py-2 shadow-sm border border-purple-100">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-emerald-600 font-medium">{sessionCorrect}正解</span>
          {sessionTotal > 0 && <span className="text-stone-400">{accuracy}%</span>}
        </div>

        {voices.length > 1 && (
          <select
            value={selectedVoice?.name ?? ""}
            onChange={e => {
              const v = voices.find(v => v.name === e.target.value) ?? null;
              setSelectedVoice(v);
            }}
            className="text-xs text-stone-600 border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            {voices.map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* かるたカード */}
      <KarutaCard
        key={question.poem.id}
        question={question}
        onAnswer={handleAnswer}
        voice={selectedVoice}
        skipSpeech={answered}
      />

      {/* 問題番号 */}
      <p className="text-center text-xs text-stone-400">
        #{question.poem.id} / {poems.length}首
      </p>

      {/* 次へ — 画面中央ポップアップ */}
      {showPopup && (
        <div key={question.poem.id + "-popup"} className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="relative pointer-events-auto popup-btn">
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-purple-300 flex flex-col overflow-hidden">
              <button
                onClick={nextQuestion}
                className="text-3xl font-bold text-purple-700 px-24 py-8 hover:bg-purple-50 transition-colors"
              >
                次へ ›
              </button>
              <div className="px-5 pb-3 text-right border-t border-purple-100">
                <Link href={`/poem/${question.poem.id}`} className="text-sm text-purple-700 font-medium hover:underline">
                  詳細を見る →
                </Link>
              </div>
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center text-sm font-bold transition-colors shadow"
            >
              ❌
            </button>
          </div>
        </div>
      )}

      {/* 次へ — キャンセル後のフォールバック */}
      {answered && !showPopup && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
          <button
            onClick={nextQuestion}
            className="border border-purple-200 text-purple-400 bg-white/80 px-6 py-1.5 rounded-full text-xs font-medium hover:bg-purple-50 transition-colors"
          >
            次へ ›
          </button>
        </div>
      )}

    </div>
  );
}
