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
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const advancedRef = useRef(false);

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
    advancedRef.current = false;
  }, [room?.currentRound]);

  // 両者回答済み → 結果表示 → p1がゲームを進める
  useEffect(() => {
    if (!room || !roomCode || room.status !== "playing") return;
    const p1Done = room.p1?.answeredIndex !== null && room.p1?.answeredIndex !== undefined;
    const p2Done = room.p2?.answeredIndex !== null && room.p2?.answeredIndex !== undefined;
    if (!p1Done || !p2Done || advancedRef.current) return;

    setShowResult(true);
    if (myRole !== "p1") return;
    advancedRef.current = true;

    const round = room.rounds[room.currentRound];
    const p1Correct = room.p1.answeredIndex === round.correctIndex;
    const p2Correct = room.p2!.answeredIndex === round.correctIndex;
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
    }, 2500);
  }, [room?.p1?.answeredIndex, room?.p2?.answeredIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createRoom() {
    if (!myName.trim()) { setError("名前を入力してください"); return; }
    setError("");
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

  function handleAnswer(index: number) {
    if (!roomCode || !myRole || myAnswer !== null || !room) return;
    if (room.status !== "playing") return;
    setMyAnswer(index);
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
  const p1Done = room.p1?.answeredIndex !== null && room.p1?.answeredIndex !== undefined;
  const p2Done = room.p2?.answeredIndex !== null && room.p2?.answeredIndex !== undefined;
  const myPlayer = myRole === "p1" ? room.p1 : room.p2;
  const oppPlayer = myRole === "p1" ? room.p2 : room.p1;

  function torifudaClass(i: number): string {
    const base = "flex-1 min-h-0 max-w-36 relative transition-all group ";
    if (!showResult) {
      if (myAnswer === i) return base + "ring-4 ring-purple-400 rounded-sm";
      return base;
    }
    if (i === round.correctIndex) return base + "ring-4 ring-emerald-500 rounded-sm";
    if (i === myAnswer && i !== round.correctIndex) return base + "ring-4 ring-red-500 rounded-sm opacity-80";
    return base + "opacity-30";
  }

  return (
    <div className="-mx-4 -mt-4 -mb-4 h-[calc(100%+2rem)] overflow-hidden flex flex-col gap-2 px-4 pt-2 pb-2">
      {/* スコアバー */}
      <div className="flex-none flex items-center justify-between bg-green-800/60 rounded-xl px-4 py-2">
        <div className="text-left">
          <p className="text-amber-100 font-bold text-sm">{room.p1.name}</p>
          <p className="text-amber-200/70 text-xs">{room.p1.score}点</p>
        </div>
        <p className="text-amber-200/60 text-xs">{room.currentRound + 1} / {TOTAL_ROUNDS}問</p>
        <div className="text-right">
          <p className="text-amber-100 font-bold text-sm">{room.p2?.name}</p>
          <p className="text-amber-200/70 text-xs">{room.p2?.score ?? 0}点</p>
        </div>
      </div>

      {/* 上の句カード */}
      <div className="flex-[2] min-h-0 flex justify-center">
        <div className="h-full bg-white border-4 border-green-700 flex flex-col items-center justify-center gap-2 px-6 pt-4 pb-2 overflow-hidden">
          <div className="flex flex-row-reverse gap-3">
            {displayPhrases.map((phrase, pi) => (
              <div
                key={pi}
                style={{ writingMode: "vertical-rl", fontSize: "clamp(1rem, 4dvh, 2.8rem)", lineHeight: 1 }}
                className="text-stone-900 tracking-widest"
              >
                {phrase}
              </div>
            ))}
          </div>
          <p style={{ fontSize: "clamp(0.65rem, 1.5dvh, 1rem)" }} className="text-stone-500 tracking-wide">
            — {poem.author}
          </p>
        </div>
      </div>

      {/* 状態テキスト */}
      <div className="flex-none flex justify-between items-center px-1 h-5">
        <span className="text-xs text-amber-200/70">
          {myPlayer?.answeredIndex !== null && myPlayer?.answeredIndex !== undefined ? "✓ 回答済み" : "選択してください"}
        </span>
        <span className="text-xs text-amber-200/70">
          {oppPlayer?.answeredIndex !== null && oppPlayer?.answeredIndex !== undefined ? "✓ 相手回答済み" : "相手は考え中..."}
        </span>
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
                  disabled={myAnswer !== null}
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
                  {showResult && i === round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-5xl font-bold text-emerald-500 drop-shadow-md">○</span>
                    </div>
                  )}
                  {showResult && i === myAnswer && i !== round.correctIndex && (
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
