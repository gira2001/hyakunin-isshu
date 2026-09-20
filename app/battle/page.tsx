"use client";

import { useState, useEffect, useRef } from "react";
import { ref, set, get, onValue, update, remove, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { poems } from "@/data/poems";
import Link from "next/link";

const WINNING_SCORE = 5;
const MAX_ROUNDS = 20;

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
  status: "waiting" | "ready" | "playing" | "finished";
  rounds: RoundData[];
  currentRound: number;
  p1: RoomPlayer;
  p2: RoomPlayer | null;
  createdAt: number;
  p1Ready?: boolean;
  p2Ready?: boolean;
  p1WantsRematch?: boolean;
  p2WantsRematch?: boolean;
  isRandom?: boolean;
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
  const shuffled = [...poems].sort(() => Math.random() - 0.5).slice(0, MAX_ROUNDS);
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
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [mode, setMode] = useState<"random" | "friend" | null>(null);
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

  // URLパラメータからモード・コードを読み込む
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const m = params.get("mode");
    if (code) { setInputCode(code.toUpperCase()); setMode("friend"); }
    else if (m === "random" || m === "friend") setMode(m);
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
    const gameOver = p1Score >= WINNING_SCORE || p2Score >= WINNING_SCORE || nextRound >= room.rounds.length;
    setTimeout(() => {
      update(ref(db, `rooms/${roomCode}`), {
        "p1/score": p1Score,
        "p1/answeredIndex": null,
        "p1/answeredAt": null,
        "p2/score": p2Score,
        "p2/answeredIndex": null,
        "p2/answeredAt": null,
        currentRound: nextRound,
        status: gameOver ? "finished" : "playing",
      });
    }, 2000);
  }, [room?.p1?.answeredIndex, room?.p2?.answeredIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ランダム待機中に相手の部屋が現れたら自動で参加（両者が同時に部屋を作った場合の救済）
  useEffect(() => {
    if (!room?.isRandom || room.status !== "waiting" || myRole !== "p1" || !roomCode) return;
    const matchRef = ref(db, "matchmaking/waiting");
    let joining = false;
    return onValue(matchRef, async (snap) => {
      if (joining) return;
      const data = snap.val();
      if (!data?.roomCode || data.roomCode === roomCode) return;
      joining = true;
      const otherCode = data.roomCode;
      let claimed = false;
      await runTransaction(matchRef, (current) => {
        if (current?.roomCode && current.roomCode !== roomCode) { claimed = true; return null; }
        return undefined;
      });
      if (!claimed) { joining = false; return; }
      const roomSnap = await get(ref(db, `rooms/${otherCode}`));
      if (!roomSnap.exists() || roomSnap.val().status !== "waiting") { joining = false; return; }
      await update(ref(db, `rooms/${otherCode}`), {
        "p2/name": myName,
        "p2/score": 0,
        "p2/answeredIndex": null,
        "p2/answeredAt": null,
        status: "ready",
        p1Ready: false,
        p2Ready: false,
      });
      await remove(ref(db, `rooms/${roomCode}`));
      setRoomCode(otherCode);
      setMyRole("p2");
    });
  }, [room?.isRandom, room?.status, myRole, roomCode]); // eslint-disable-line

  // 両者準備OKで p1 がゲーム開始
  useEffect(() => {
    if (!room || !roomCode || room.status !== "ready") return;
    if (!room.p1Ready || !room.p2Ready) return;
    if (myRole !== "p1") return;
    // 音声合成を事前にキャンセルしてウォームアップ
    window.speechSynthesis.cancel();
    update(ref(db, `rooms/${roomCode}`), {
      status: "playing",
      p1Ready: false,
      p2Ready: false,
    });
  }, [room?.p1Ready, room?.p2Ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // 両者リマッチ希望で p1 がリセット
  useEffect(() => {
    if (!room || !roomCode || room.status !== "finished") return;
    if (!room.p1WantsRematch || !room.p2WantsRematch) return;
    if (myRole !== "p1") return;
    update(ref(db, `rooms/${roomCode}`), {
      status: "ready",
      rounds: generateRounds(),
      currentRound: 0,
      "p1/score": 0,
      "p1/answeredIndex": null,
      "p1/answeredAt": null,
      "p2/score": 0,
      "p2/answeredIndex": null,
      "p2/answeredAt": null,
      p1WantsRematch: false,
      p2WantsRematch: false,
      p1Ready: false,
      p2Ready: false,
    });
  }, [room?.p1WantsRematch, room?.p2WantsRematch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function searchRandom() {
    if (!myName.trim()) { setError("名前を入力してください"); return; }
    setError("");
    setIsMatchmaking(true);
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));

    try {
      const matchRef = ref(db, "matchmaking/waiting");

      // get() でサーバーデータを取得してローカルキャッシュを更新してからトランザクションを実行
      const preSnap = await get(matchRef);
      let claimedCode: string | null = null;

      if (preSnap.exists() && preSnap.val()?.roomCode) {
        // キャッシュが更新された状態でトランザクション（競合なく取得）
        await runTransaction(matchRef, (current) => {
          if (current?.roomCode) {
            claimedCode = current.roomCode;
            return null; // キューから削除（取得）
          }
          return undefined; // すでに他の人が取得済み → abort
        });
      }

      if (claimedCode) {
        const snap = await get(ref(db, `rooms/${claimedCode}`));
        if (snap.exists() && snap.val().status === "waiting") {
          await update(ref(db, `rooms/${claimedCode}`), {
            "p2/name": myName.trim(),
            "p2/score": 0,
            "p2/answeredIndex": null,
            "p2/answeredAt": null,
            status: "ready",
            p1Ready: false,
            p2Ready: false,
          });
          setRoomCode(claimedCode);
          setMyRole("p2");
          setIsMatchmaking(false);
          return;
        }
      }

      // 誰も待っていない → 自分がルームを作ってキューに登録
      const code = generateCode();
      await set(ref(db, `rooms/${code}`), {
        status: "waiting",
        rounds: generateRounds(),
        currentRound: 0,
        createdAt: Date.now(),
        isRandom: true,
        p1: { name: myName.trim(), score: 0, answeredIndex: null, answeredAt: null },
        p2: null,
      });
      await set(matchRef, { roomCode: code, createdAt: Date.now() });
      setRoomCode(code);
      setMyRole("p1");
      setIsMatchmaking(false);
    } catch (e) {
      setError("マッチング中にエラーが発生しました: " + String(e));
      setIsMatchmaking(false);
    }
  }

  async function createRoom() {
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
      status: "ready",
      p1Ready: false,
      p2Ready: false,
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
    // マッチング中
    if (isMatchmaking) {
      return (
        <div className="max-w-sm mx-auto pt-8 text-center space-y-6">
          <h2 className="text-xl font-bold text-purple-900">対戦相手を探しています...</h2>
          <div className="flex justify-center gap-1.5 py-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-stone-400 text-sm">マッチングが完了するまでお待ちください</p>
          <button
            onClick={() => { remove(ref(db, "matchmaking/waiting")); setIsMatchmaking(false); }}
            className="w-full py-3 rounded-xl font-bold text-base border-2 border-stone-300 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      );
    }

    // モード選択
    if (!mode) {
      return (
        <div className="max-w-sm mx-auto pt-8 space-y-5">
          <h1 className="text-2xl font-bold text-purple-900 text-center tracking-widest">対戦モード</h1>
          <Link
            href="/battle?mode=random"
            onClick={() => setMode("random")}
            className="block bg-purple-700 text-white rounded-2xl p-6 text-center hover:bg-purple-600 transition-colors shadow-lg"
          >
            <p className="text-4xl mb-2">🎲</p>
            <p className="text-xl font-bold">ランダム対戦</p>
            <p className="text-purple-200 text-sm mt-1">知らない人とマッチング</p>
          </Link>
          <Link
            href="/battle?mode=friend"
            onClick={() => setMode("friend")}
            className="block bg-white border-2 border-purple-400 text-purple-700 rounded-2xl p-6 text-center hover:bg-purple-50 transition-colors shadow"
          >
            <p className="text-4xl mb-2">👥</p>
            <p className="text-xl font-bold">友人と対戦</p>
            <p className="text-purple-400 text-sm mt-1">ルームコードで招待</p>
          </Link>
        </div>
      );
    }

    // ランダム対戦ロビー
    if (mode === "random") {
      return (
        <div className="max-w-sm mx-auto pt-8 space-y-5">
          <div className="flex items-center gap-2">
            <Link href="/battle" onClick={() => setMode(null)} className="text-purple-400 hover:text-purple-600 text-sm">← 戻る</Link>
            <h1 className="text-xl font-bold text-purple-900 tracking-widest">ランダム対戦</h1>
          </div>
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
            onClick={searchRandom}
            className="w-full py-3 rounded-xl font-bold text-lg transition-colors shadow bg-purple-700 text-white hover:bg-purple-600"
          >
            対戦相手を探す
          </button>
        </div>
      );
    }

    // 友人と対戦ロビー
    return (
      <div className="max-w-sm mx-auto pt-8 space-y-5">
        <div className="flex items-center gap-2">
          <Link href="/battle" onClick={() => setMode(null)} className="text-purple-400 hover:text-purple-600 text-sm">← 戻る</Link>
          <h1 className="text-xl font-bold text-purple-900 tracking-widest">友人と対戦</h1>
        </div>
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
          className="w-full py-3 rounded-xl font-bold text-lg transition-colors shadow bg-purple-700 text-white hover:bg-purple-600"
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
            className={`w-full py-3 rounded-xl font-bold text-lg transition-colors ${
              inputCode.trim()
                ? "bg-purple-700 text-white hover:bg-purple-600 shadow"
                : "bg-white border-2 border-purple-400 text-purple-700 hover:bg-purple-50"
            }`}
          >
            参加する
          </button>
        </div>
      </div>
    );
  }

  // ─── 待機中 ───
  if (!room || room.status === "waiting") {
    async function cancelWaiting() {
      if (room?.isRandom) await remove(ref(db, "matchmaking/waiting"));
      setRoomCode(null);
      setMyRole(null);
    }

    // ランダム対戦待機中は自動マッチング専用画面
    if (room?.isRandom) {
      return (
        <div className="max-w-sm mx-auto pt-8 text-center space-y-6">
          <h2 className="text-xl font-bold text-purple-900">対戦相手を探しています...</h2>
          <div className="flex justify-center gap-1.5 py-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-stone-400 text-sm">相手が見つかり次第、自動的に対戦が始まります</p>
          <button
            onClick={cancelWaiting}
            className="w-full py-3 rounded-xl font-bold text-base border-2 border-stone-300 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      );
    }

    // 友達対戦待機中はコード・URL・共有ボタンを表示
    return (
      <div className="max-w-sm mx-auto pt-8 text-center space-y-6">
        <h2 className="text-xl font-bold text-purple-900">友達を待っています</h2>
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 space-y-2">
          <p className="text-stone-400 text-sm">ルームコード</p>
          <p className="text-5xl font-bold text-purple-700 font-mono tracking-widest">{roomCode}</p>
        </div>
        <div className="bg-white/60 border border-stone-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-stone-500">URLを共有</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-stone-600 break-all font-mono flex-1">
              {window.location.origin}/battle?code={roomCode}
            </p>
            <button
              onClick={copyUrl}
              title={copied ? "コピーしました！" : "URLをコピー"}
              className="shrink-0 text-purple-500 hover:text-purple-700 transition-colors"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <a
            href={`https://line.me/R/msg/text/?${encodeURIComponent(`百人一首対戦に招待！\n${window.location.origin}/battle?code=${roomCode}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#06C755] text-white text-sm font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 6.08 2 11.1c0 3.49 2.19 6.55 5.47 8.27l-.67 2.49c-.07.26.21.47.44.33l2.89-1.74A11.3 11.3 0 0 0 12 20.2c5.52 0 10-4.08 10-9.1S17.52 2 12 2z"/></svg>
            LINE
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`百人一首対戦に招待！一緒にやろう🃏`)}&url=${encodeURIComponent(`${window.location.origin}/battle?code=${roomCode}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black text-white text-sm font-bold px-4 py-2 rounded-full hover:opacity-80 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X
          </a>
        </div>
        <div className="flex items-center gap-2 justify-center text-stone-400 text-sm">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
          <span>相手の参加を待っています...</span>
        </div>
      </div>
    );
  }

  // ─── 準備OK ───
  if (room.status === "ready") {
    const myReady = myRole === "p1" ? room.p1Ready : room.p2Ready;
    const oppReady = myRole === "p1" ? room.p2Ready : room.p1Ready;
    const myReadyName = myRole === "p1" ? (room.p1.name || "あなた") : (room.p2?.name || "あなた");
    const oppReadyName = myRole === "p1" ? (room.p2?.name || "あいて") : (room.p1.name || "あいて");
    function handleReady() {
      // 準備OK時に音声合成をウォームアップ
      window.speechSynthesis.cancel();
      const warmup = new SpeechSynthesisUtterance("");
      warmup.lang = "ja-JP";
      window.speechSynthesis.speak(warmup);
      update(ref(db, `rooms/${roomCode!}`), { [`${myRole}Ready`]: true });
    }
    return (
      <div className="max-w-sm mx-auto pt-6 text-center space-y-5">
        <div className="flex justify-around text-sm text-stone-500">
          <div className="flex flex-col items-center gap-1">
            <p>{myReadyName}</p>
            <span className="text-2xl">{myReady ? "✅" : "⏳"}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p>{oppReadyName}</p>
            <span className="text-2xl">{oppReady ? "✅" : "⏳"}</span>
          </div>
        </div>

        {oppReady && !myReady && (
          <p className="text-sm text-purple-600 font-bold">相手が準備できました！</p>
        )}
        {myReady && !oppReady && (
          <p className="text-sm text-stone-400">相手の準備を待っています...</p>
        )}

        {!myReady && (
          <button
            onClick={handleReady}
            className="w-full bg-purple-700 text-white py-4 rounded-xl font-bold text-xl hover:bg-purple-600 transition-colors shadow-lg"
          >
            準備OK！
          </button>
        )}
      </div>
    );
  }

  // ─── 終了 ───
  if (room.status === "finished") {
    const myScore = myRole === "p1" ? room.p1.score : room.p2?.score ?? 0;
    const oppScore = myRole === "p1" ? room.p2?.score ?? 0 : room.p1.score;
    const myDisplayName = myRole === "p1" ? (room.p1.name || "あなた") : (room.p2?.name || "あなた");
    const oppDisplayName = myRole === "p1" ? (room.p2?.name || "あいて") : (room.p1.name || "あいて");
    const won = myScore > oppScore;
    const draw = myScore === oppScore;
    return (
      <div className="max-w-sm mx-auto pt-8 text-center space-y-6">
        <h2 className="text-4xl font-bold text-purple-900">
          {draw ? "引き分け" : won ? "勝利！" : "敗北..."}
        </h2>
        <div className="bg-white rounded-2xl border-2 border-purple-200 p-8">
          <div className="flex justify-around items-center">
            <div className="flex flex-col items-center gap-1">
              <p className="text-stone-500 text-sm">{myDisplayName}</p>
              <p className="text-5xl font-bold text-purple-700">{["〇","一","二","三","四","五"][myScore] ?? myScore}</p>
            </div>
            <p className="text-stone-300 text-2xl">vs</p>
            <div className="flex flex-col items-center gap-1">
              <p className="text-stone-500 text-sm">{oppDisplayName}</p>
              <p className="text-5xl font-bold text-stone-500">{["〇","一","二","三","四","五"][oppScore] ?? oppScore}</p>
            </div>
          </div>
        </div>
        {(() => {
          const myWants = myRole === "p1" ? room.p1WantsRematch : room.p2WantsRematch;
          const oppWants = myRole === "p1" ? room.p2WantsRematch : room.p1WantsRematch;
          return myWants ? (
            <div className="bg-purple-50 border border-purple-200 rounded-xl py-3 text-center text-sm text-purple-600">
              相手の承認を待っています...
            </div>
          ) : (
            <button
              onClick={() => update(ref(db, `rooms/${roomCode!}`), { [`${myRole}WantsRematch`]: true })}
              className="block w-full bg-purple-700 text-white py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors"
            >
              {oppWants ? "相手もリマッチ希望！ → 開始する" : "もう一度対戦"}
            </button>
          );
        })()}
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
  const p1DisplayName = myRole === "p1" ? (room.p1.name || "あなた") : (room.p1.name || "あいて");
  const p2DisplayName = myRole === "p2" ? (room.p2?.name || "あなた") : (room.p2?.name || "あいて");

  function torifudaClass(i: number): string {
    const base = "flex-1 min-h-0 max-w-[42vw] sm:max-w-36 relative transition-all group ";
    if (myAnswer === null) return base;
    if (i === round.correctIndex) return base + "ring-4 ring-emerald-500 rounded-sm";
    if (i === myAnswer && i !== round.correctIndex) return base + "ring-4 ring-red-500 rounded-sm opacity-80";
    return base + "opacity-30";
  }

  return (
    <div className="-mx-4 -mt-4 -mb-4 h-[calc(100%+2rem)] overflow-hidden flex flex-col gap-2 px-4 pt-2 pb-2">
      {/* スコアバー */}
      <div className="flex-none flex items-center justify-between bg-green-800/60 rounded-xl px-4 py-2">
        <div className="text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 shrink-0 rounded-full ${p1Done ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
            <p className="text-amber-100 font-bold text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{p1DisplayName}</p>
          </div>
          <p className="text-amber-200/70 text-sm font-bold">{["〇","一","二","三","四","五"][room.p1.score] ?? room.p1.score}</p>
        </div>
        <p className="text-amber-200/60 text-xs shrink-0 px-2">第{room.currentRound + 1}問</p>
        <div className="text-right min-w-0">
          <div className="flex items-center justify-end gap-1.5">
            <p className="text-amber-100 font-bold text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{p2DisplayName}</p>
            <div className={`w-2 h-2 shrink-0 rounded-full ${p2Done ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
          </div>
          <p className="text-amber-200/70 text-sm font-bold text-right">{["〇","一","二","三","四","五"][room.p2?.score ?? 0] ?? (room.p2?.score ?? 0)}</p>
        </div>
      </div>

      {/* 上の句カード */}
      <div className="flex-[2] min-h-0 flex justify-center">
        <div className="h-full bg-white border-4 border-green-700 flex flex-col items-center justify-center gap-2 px-3 sm:px-6 pt-2 sm:pt-4 pb-2 overflow-hidden">
          <div className="flex flex-row-reverse gap-3">
            {displayPhrases.map((phrase, pi) => {
              const offset = displayPhrases.slice(0, pi).reduce((s, p) => s + p.length, 0);
              return (
                <div
                  key={pi}
                  style={{ writingMode: "vertical-rl", fontSize: phrase.length >= 8 ? "clamp(0.72rem, 2.9dvh, 2rem)" : phrase.length === 7 ? "clamp(0.85rem, 3.4dvh, 2.3rem)" : "clamp(1rem, 4dvh, 2.8rem)", lineHeight: 1 }}
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
      <div className="flex-[3] min-h-0 flex flex-col gap-2 sm:gap-6">
        {[[0, 1], [2, 3]].map((row, rowIdx) => (
          <div key={rowIdx} className="flex-1 min-h-0 flex gap-2 sm:gap-6 justify-center">
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
                    <div className="w-full flex flex-row-reverse h-full items-start justify-center pt-3">
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
                      <span className="text-3xl sm:text-5xl font-bold text-emerald-400/40 drop-shadow">○</span>
                    </div>
                  )}
                  {oppPlayer?.answeredIndex != null && oppPlayer.answeredIndex === i && i !== round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-3xl sm:text-5xl font-bold text-red-400/40 drop-shadow">✕</span>
                    </div>
                  )}
                  {myAnswer !== null && i === round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-3xl sm:text-5xl font-bold text-emerald-500 drop-shadow-md">○</span>
                    </div>
                  )}
                  {myAnswer !== null && i === myAnswer && i !== round.correctIndex && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-3xl sm:text-5xl font-bold text-red-500 drop-shadow-md">✕</span>
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
