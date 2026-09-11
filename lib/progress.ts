"use client";

import type { ProgressMap, PoemProgress } from "@/types/poem";

const STORAGE_KEY = "hyakunin-isshu-progress";

export function getProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function updateProgress(poemId: number, correct: boolean): void {
  const progress = getProgress();
  const current: PoemProgress = progress[poemId] ?? {
    correctCount: 0,
    incorrectCount: 0,
    streak: 0,
    lastAnswered: 0,
  };

  if (correct) {
    current.correctCount += 1;
    current.streak += 1;
  } else {
    current.incorrectCount += 1;
    current.streak = 0;
  }
  current.lastAnswered = Date.now();

  progress[poemId] = current;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getMasteryLevel(progress: PoemProgress | undefined): "new" | "learning" | "mastered" {
  if (!progress || progress.correctCount + progress.incorrectCount === 0) return "new";
  if (progress.streak >= 3) return "mastered";
  return "learning";
}

export function getAccuracy(progress: PoemProgress | undefined): number {
  if (!progress) return 0;
  const total = progress.correctCount + progress.incorrectCount;
  if (total === 0) return 0;
  return Math.round((progress.correctCount / total) * 100);
}

export function clearProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}
