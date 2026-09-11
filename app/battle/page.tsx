"use client";

import { useState, useEffect, useRef } from "react";
import { ref, set, get, onValue, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { poems } from "@/data/poems";
import Link from "next/link";

const TOTAL_ROUNDS = 5;

interface RoomPlayer {
  name: string;
  score: number;
  answeredIndex: number | null;
  answeredAt: number | null;
}

interface RoundData {
  poemId: number;
  optionIds: number[];
  correctIndex: number;
}

interface RoomData {
  status: "waiting" | "playing" | "finished";
  rounds: RoundData[];
  currentRound: number;
  p1: RoomPlayer;
  p2: RoomPlayer | null;
  createdAt: number;
}

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

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateRounds(): RoundData[] {
  const shuffled = [...poems].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
  return shuffled.map((poem) => {
    const wrong = [...poems]
      .filter((p) => p.id !== poem.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const all = [poem, ...wrong].sort(() => Math.random() - 0.5);
    return {
      poemId: poem.id,
      optionIds: all.map((p) => p.id),
      correctIndex: all.findIndex((p) => p.id === poem.id),
    };
  });
}

export default function BattlePage() {
  const [myName, setMyName] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"p1" | "p2" | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const advancedRef = useRef(false);
  const revealedRef = useRef(0);
  const selectedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      const ja = voices.find((v) => v.lang.startsWith("ja"));
      if (ja) setVoice(ja);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // URLパラメータからコードを読み込む
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) setInputCode(code.toUpperCase());
  }, []);

  // Firebaseルーム購読
  useEffect(() => {
    if (!roomCode) return;
    return onValue(ref(db, `rooms/${roomCode}`), (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      if (data.rounds) {
        const roundsArr: RoundData[] = Array.isArray(data.rounds)
          ? data.rounds
          : Object.values(data.rounds);
        data.rounds = roundsArr.map((r: RoundData) => ({
          ...r,
          optionIds: Array.isArray(r.optionIds)
            ? r.optionIds
            : Object.values(r.optionIds as Record<string, number>),
        }));
      }
      setRoom(data as RoomData);
    });
  }, [roomCode]);

  // ラウンド変更時にリセット
  useEffect(() => {
    setMyAnswer(null);
    setShowResult(false);
    setRevealedCount(0);
    revealedRef.current = 0;
    selectedRef.current = false;
    advancedRef.current = false;
  }, [room?.currentRound]);

  // 音読＋文字逐次表示
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    const curRound = room.rounds[room.currentRound];
    if (!curRound) return;
    const poemData = poems.find((p) => p.id === curRound.poemId);
    if (!poemData) return;
    const displayPhrases = poemData.kamiNoKu.split(/\s+/).filter(Boolean);
    const readingPhrases = poemData.reading.split(/\s+/).slice(0, 3).map(toModernPronunciation);
    const total = displayPhrases.reduce((s, p) => s + p.length, 0);
    const timers = timersRef.current;

    function clearAll() { timers.forEach(clearTimeout); timers.length = 0; }

    function revealPhrase(phraseIdx: number) {
      if (selectedRef.current || phraseIdx >= displayPhrases.length) return;
      const offset = displayPhrases.slice(0, phraseIdx).reduce((s, p) => s + p.length, 0);
      displayPhrases[phraseIdx].split("").forEach((_, i) => {
        timers.push(setTimeout(() => {
          if (selectedRef.current) return;
          const next = offset + i + 1;
          revealedRef.current = Math.max(revealedRef.current, next);
          setRevealedCount((prev) => Math.max(prev, next));
        }, i * 90));
      });
    }

    function speakChain(idx: number) {
      if (selectedRef.current || idx >= readingPhrases.length) return;
      const u = new SpeechSynthesisUtterance(readingPhrases[idx]);
      u.lang = "ja-JP";
      u.rate = 0.65;
      if (voice) u.voice = voice;

      let revealed = false;
      function doReveal() {
        if (revealed) return;
        revealed = true;
        revealPhrase(idx);
      }
      u.onstart = doReveal;
      timers.push(setTimeout(doReveal, 400)); // iOS fallback

      let advanced = false;
      function doAdvance() {
        if (advanced) return;
        advanced = true;
        if (idx < readingPhrases.length - 1) {
          timers.push(setTimeout(() => speakChain(idx + 1), 750));
        } else {
          timers.push(setTimeout(() => {
            if (!selectedRef.current) { revealedRef.current = total; setRevealedCount(total); }
          }, 90 * (displayPhrases[idx]?.length ?? 0)));
        }
      }
      u.onend = doAdvance;
      timers.push(setTimeout(doAdvance, readingPhrases[idx].length * 350 + 1500)); // iOS fallback

      window.speechSynthesis.speak(u);
    }

    window.speechSynthesis.cancel();
    speakChain(0);
    return () => { window.speechSynthesis.cancel(); clearAll(); };
  }, [room?.currentRound, room?.status, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  // 誰かが正解したら（または両者回答済みなら）p1がゲームを進める
  useEffect(() => {
    if (!room || !roomCode || room.status !== "playing") return;
    const curRound = room.rounds[room.currentRound];
    if (!curRound) return;
    const p1Answered = room.p1?.answeredIndex != null;
    const p2Answered = room.p2?.answeredIndex != null;
    const p1Correct = p1Answered && room.p1.answeredIndex === curRound.correctIndex;
    const p2Correct = p2Answered && room.p2?.answeredIndex === curRound.correctIndex;
    const shouldAdvance = p1Correct || p2Correct || (p1Answered && p2Answered);
    if (!shouldAdvance || advancedRef.current) return;

    if (myRole !== "p1") return;
    advancedRef.current = true;

    let p1Score = room.p1.score;
    let p2Score = room.p2!.score;
    if (p1Correct && p2Correct) {
      if (room.p1.answeredAt! < room.p2!.answeredAt!) p1Score++;
      else p2Score++;
    } else if (p1Correct) {
      p1Score++;
    } else if (p2Correct) {
      p2Score++;
    }

    const nextRound = room.currentRound + 1;
    setTimeout(() => {
      update(ref(db, `rooms/${roomCode}`), {
        "p1/score": p1Score,
        "p1/answeredIndex": null,
        "p1/answeredAt": null,
        "p2/score": p2Score,
        "p2/answeredIndex": null,
        "p2/answeredAt": null,
        currentRound: nextRound,
        status: nextRound >= TOTAL_ROUNDS ? "finished" : "playing",
      });
    }, 2000);
  }, [room?.p1?.answeredIndex, room?.p2?.answeredIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createRoom() {
    if (!myName.trim()) { setError("名前を入力してください"); return; }
    setError("");
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    const code = generateCode();
    await set(ref(db, `rooms/${code}`), {
      status: "waiting",
      rounds: generateRounds(),
      currentRound: 0,
      createdAt: Date.now(),
      p1: { name: myName.trim(), score: 0, answeredIndex: null, answeredAt: null },
      p2: null,
    });
    setRoomCode(code);
    setMyRole("p1");
  }

  async function joinRoom() {
    if (!myName.trim()) { setError("名前を入力してください"); return; }
    if (!inputCode.trim()) { setError("コードを入力してください"); return; }
    setError("");
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    const code = inputCode.trim().toUpperCase();
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) { setError("ルームが見つかりません"); return; }
    const data = snap.val() as RoomData;
    if (data.status !== "waiting") { setError("このルームはすでに開始されています"); return; }
    if (data.p2) { setError("すでに満員です"); return; }
    await update(ref(db, `rooms/${code}`), {
      "p2/name": myName.trim(),
      "p2/score": 0,
      "p2/answeredIndex": null,
      "p2/answeredAt": null,
      status: "playing",
    });
    setRoomCode(code);
    setMyRole("p2");
  }

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

  function handleAnswer(index: number) {
    if (!roomCode || !myRole || myAnswer !== null || !room) return;
    if (room.status !== "playing") return;
    selectedRef.current = true;
    window.speechSynthesis.cancel();
    timersRef.current.forEach(clearTimeout);
    setMyAnswer(index);
    playSound(index === round.correctIndex);
    update(ref(db, `rooms/${roomCode}`), {
      [`${myRole}/answeredIndex`]: index,
      [`${myRole}/answeredAt`]: Date.now(),
    });
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/battle?code=${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── ロビー ───
  if (!roomCode) {
    return (
      <div className="max-w-sm mx-auto pt-8 space-y-5">
        <h1 className="text-2xl font-bold text-purple-900 text-center tracking-widest">対戦モード</h1>
        <div>
          <label className="text-sm text-stone-600 mb-1 block">あなたの名前</label>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="名前を入力"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 bg-white focus:outline-none focus:border-purple-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          onClick={createRoom}
          className="w-full bg-purple-700 text-white py-3 rounded-xl font-bold text-lg hover:bg-purple-600 transition-colors shadow"
        >
          ルームを作成
        </button>
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-stone-300" />
          <span className="text-stone-400 text-sm">または</span>
          <hr className="flex-1 border-stone-300" />
        </div>
        <div className="space-y-2">
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="ルームコードを入力"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 bg-white font-mono tracking-widest focus:outline-none focus:border-purple-400"
            maxLength={6}
          />
          <button
            onClick={joinRoom}
            className="w-full bg-white border-2 border-purple-400 text-purple-700 py-3 rounded-xl font-bold text-lg hover:bg-purple-50 transition-colors"
          >
            参加する
          </button>
        </div>
      </div>
    );
  }

  // ─── 待機中 ───
  if (!room || room.status === "waiting") {
    return (
      <div className="max-w-sm mx-auto pt-8 text-center space-y-6">
        <h2 className="text-xl font-bold text-purple-900">友達を待っています</h2>
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 space-y-2">
          <p className="text-stone-400 text-sm">ルームコード</p>
          <p className="text-5xl font-bold text-purple-700 font-mono tracking-widest">{roomCode}</p>
        </div>
        <div className="bg-white/60 border border-stone-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-stone-500">URLを共有</p>
          <p className="text-xs text-stone-600 break-all font-mono">
            {window.location.origin}/battle?code={roomCode}
          </p>
          <button onClick={copyUrl} className="text-xs text-purple-600 hover:underline font-medium">
            {copied ? "コピーしました！" : "URLをコピー"}
          </button>
        </div>
        <div className="flex items-center gap-2 justify-center text-stone-400 text-sm">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
          <span>相手の参加を待っています...</span>
        </div>
      </div>
    );
  }

  // ─── 終了 ───
  if (room.status === "finished") {
    const myScore = myRole === "p1" ? room.p1.score : room.p2?.score ?? 0;
    const oppScore = myRole === "p1" ? room.p2?.score ?? 0 : room.p1.score;
    const myDisplayName = myRole === "p1" ? room.p1.name : room.p2?.name ?? "";
    const oppDisplayName = myRole === "p1" ? room.p2?.name ?? "相手" : room.p1.name;
    const won = myScore > oppScore;
    const draw = myScore === oppScore;
    return (
      <div className="max-w-sm mx-auto pt-8 text-center space-y-6">
        <h2 className="text-4xl font-bold text-purple-900">
          {draw ? "引き分け" : won ? "勝利！🎉" : "敗北..."}
        </h2>
        <div className="bg-white rounded-2xl border-2 border-purple-200 p-8">
          <div className="flex justify-around items-center">
            <div>
              <p className="text-stone-500 text-sm mb-1">{myDisplayName}</p>
              <p className="text-5xl font-bold text-purple-700">{myScore}</p>
            </div>
            <p className="text-stone-300 text-2xl">vs</p>
            <div>
              <p className="text-stone-500 text-sm mb-1">{oppDisplayName}</p>
              <p className="text-5xl font-bold text-stone-500">{oppScore}</p>
            </div>
          </div>
        </div>
        <Link
          href="/battle"
          className="block bg-purple-700 text-white py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors"
        >
          もう一度対戦
        </Link>
        <Link href="/hyakunin" className="block text-sm text-purple-700 hover:underline">
          百人一首モードへ
        </Link>
      </div>
    );
  }

  // ─── ゲーム中 ───
  const round = room.rounds[room.currentRound];
  const poem = poems.find((p) => p.id === round.poemId)!;
  const displayPhrases = poem.kamiNoKu.split(/\s+/).filter(Boolean);
  const p1Done = room.p1?.answeredIndex != null;
  const p2Done = room.p2?.answeredIndex != null;
  const myPlayer = myRole === "p1" ? room.p1 : room.p2;
  const oppPlayer = myRole === "p1" ? room.p2 : room.p1;
  const oppAnsweredCorrectly = oppPlayer?.answeredIndex != null && oppPlayer.answeredIndex === round.correctIndex;

  function torifudaClass(i: number): string {
    const base = "flex-1 min-h-0 max-w-36 relative transition-all group ";
    if (myAnswer === null) return base;
    if (i === round.correctIndex) return base + "ring-4 ring-emerald-500 rounded-sm";
    if (i === myAnswer && i !== round.correctIndex) return base + "ring-4 ring-red-500 rounded-sm opacity-80";
    return base + "opacity-30";
  }

  return (
    <div className="-mx-4 -mt-4 -mb-4 h-[calc(100%+2rem)] overflow-hidden flex flex-col gap-2 px-4 pt-2 pb-2">
      {/* スコアバー */}
      <div className="flex-none flex items-center justify-between bg-green-800/60 rounded-xl px-4 py-2">
        <div className="text-left">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${p1Done ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
            <p className="text-amber-100 font-bold text-sm">{room.p1.name}</p>
          </div>
          <p className="text-amber-200/70 text-xs">{room.p1.score}点</p>
        </div>
        <p className="text-amber-200/60 text-xs">{room.currentRound + 1} / {TOTAL_ROUNDS}問</p>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <p className="text-amber-100 font-bold text-sm">{room.p2?.name}</p>
            <div className={`w-2 h-2 rounded-full ${p2Done ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
          </div>
          <p className="text-amber-200/70 text-xs">{room.p2?.score ?? 0}点</p>
        </div>
      </div>

      {/* 上の句カード */}
      <div className="flex-[2] min-h-0 flex justify-center">
        <div className="h-full bg-white border-4 border-green-700 flex flex-col items-center justify-center gap-2 px-6 pt-4 pb-2 overflow-hidden">
          <div className="flex flex-row-reverse gap-3">
            {displayPhrases.map((phrase, pi) => {
              const offset = displayPhrases.slice(0, pi).reduce((s, p) => s + p.length, 0);
              return (
                <div
                  key={pi}
                  style={{ writingMode: "vertical-rl", fontSize: "clamp(1rem, 4dvh, 2.8rem)", lineHeight: 1 }}
                  className="text-stone-900 tracking-widest"
                >
                  {phrase.split("").map((char, ci) => (
                    <span key={ci} className={`transition-opacity duration-100 ${offset + ci < revealedCount ? "opacity-100" : "opacity-0"}`}>
                      {char}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: "clamp(0.65rem, 1.5dvh, 1rem)" }} className="text-stone-500 tracking-wide">
            — {poem.author}
          </p>
        </div>
      </div>

      {/* 下の句カード */}
      <div className="flex-[3] min-h-0 flex flex-col gap-6">
        {[[0, 1], [2, 3]].map((row, rowIdx) => (
          <div key={rowIdx} className="flex-1 min-h-0 flex gap-6 justify-center">
            {row.map((i) => {
              const optPoem = poems.find((p) => p.id === round.optionIds[i])!;
              const r = optPoem.reading.split(/\s+/).slice(3).join("");
              const cols: string[] = [];
              for (let j = 0; j < r.length; j += 5) cols.push(r.slice(j, j + 5));
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={myAnswer !== null || oppAnsweredCorrectly}
                  className={torifudaClass(i)}
                >
                  <div
                    className="w-full h-full bg-white border-4 border-green-700 transition-colors group-hover:bg-green-50"
                    style={{ containerType: "size" }}
                  >
                    <div className="w-full flex flex-row-reverse h-full items-center justify-center">
                      {cols.map((col, ci) => (
                        <div
                          key={ci}
                          style={{ writingMode: "vertical-rl", fontSize: "min(14cqh, calc(100cqw / 3))", lineHeight: 1 }}
                          className="text-stone-900 tracking-widest"
                        >
                          {col}
                        </div>
                      ))}
                    </div>
                  </div>
                  {oppPlayer?.answeredIndex != null && oppPlayer.answeredIndex === i && i === round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-5xl font-bold text-emerald-400/40 drop-shadow">○</span>
                    </div>
                  )}
                  {oppPlayer?.answeredIndex != null && oppPlayer.answeredIndex === i && i !== round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-5xl font-bold text-red-400/40 drop-shadow">✕</span>
                    </div>
                  )}
                  {myAnswer !== null && i === round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-5xl font-bold text-emerald-500 drop-shadow-md">○</span>
                    </div>
                  )}
                  {myAnswer !== null && i === myAnswer && i !== round.correctIndex && (
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
    </div>
  );
}
