"use client";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// 鈴・風鈴用: 正弦波を柔らかく打ち込み、長い余韻で減衰させる
function bellPartial(freq: number, gain: number, decay: number, t: number) {
  const context = getCtx();
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  // 4ms のソフトアタックでクリック音を消す
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(gain, t + 0.004);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

// 木魚・拍子木用: 三角波 + 打撃直後のピッチグライドで木質感を出す
function woodStrike(freq: number, gain: number, decay: number, t: number) {
  const context = getCtx();
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.type = "triangle";
  // 打った瞬間は高め → 25ms で本来の音程へ落ち着く（物理的な打撃感）
  osc.frequency.setValueAtTime(freq * 1.9, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.025);
  gainNode.gain.setValueAtTime(gain, t);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

// 正解: 風鈴のような透き通った響き
// 不整数倍音（×2.12, ×3.58）で整数倍とは異なる金属的な余韻を作る
export function playCorrect() {
  const t = getCtx().currentTime;
  bellPartial(740,  0.28, 1.4,  t);
  bellPartial(1569, 0.15, 0.85, t); // 740 × 2.12
  bellPartial(2650, 0.07, 0.4,  t); // 740 × 3.58
}

// 不正解: 木魚のような短く乾いた音
export function playIncorrect() {
  const t = getCtx().currentTime;
  woodStrike(320, 0.4,  0.22, t);
  woodStrike(480, 0.15, 0.11, t);
}
