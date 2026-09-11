import type { Poem, ProgressMap, QuizQuestion, HyakuninQuestion } from "@/types/poem";
import { getMasteryLevel } from "@/lib/progress";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPriority(poemId: number, progress: ProgressMap): number {
  const p = progress[poemId];
  if (!p || p.correctCount + p.incorrectCount === 0) return 100; // unattended: highest
  if (p.streak >= 3) return 1; // mastered: lowest
  const accuracy = p.correctCount / (p.correctCount + p.incorrectCount);
  const hoursSince = (Date.now() - p.lastAnswered) / 3600000;
  return (1 - accuracy) * 50 + Math.min(hoursSince, 24) + 5;
}

export function selectPoem(poems: Poem[], progress: ProgressMap): Poem {
  const weighted = poems.map((poem) => ({
    poem,
    weight: getPriority(poem.id, progress),
  }));

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const { poem, weight } of weighted) {
    rand -= weight;
    if (rand <= 0) return poem;
  }
  return poems[0];
}

export function generateHyakuninQuestion(poems: Poem[], progress: ProgressMap): HyakuninQuestion {
  const poem = selectPoem(poems, progress);
  const wrongPoems = shuffle(poems.filter((p) => p.id !== poem.id)).slice(0, 3);
  const allPoems = shuffle([poem, ...wrongPoems]);
  const correctIndex = allPoems.findIndex((p) => p.id === poem.id);
  return {
    poem,
    options: allPoems.map((p) => ({
      text: p.shimoNoKu,
      poemId: p.id,
      readingShimo: p.reading.split(/\s+/).slice(3).join(""),
    })),
    correctIndex,
  };
}

export function generateQuestion(poems: Poem[], progress: ProgressMap): QuizQuestion {
  const poem = selectPoem(poems, progress);
  const wrongPoems = shuffle(poems.filter((p) => p.id !== poem.id)).slice(0, 3);
  const wrongOptions = wrongPoems.map((p) => p.shimoNoKu);

  const allOptions = shuffle([poem.shimoNoKu, ...wrongOptions]);
  const correctIndex = allOptions.indexOf(poem.shimoNoKu);

  return { poem, options: allOptions, correctIndex };
}

export function getStats(poems: Poem[], progress: ProgressMap) {
  const attempted = poems.filter((p) => {
    const pr = progress[p.id];
    return pr && pr.correctCount + pr.incorrectCount > 0;
  });
  const mastered = poems.filter((p) => getMasteryLevel(progress[p.id]) === "mastered");
  const totalCorrect = Object.values(progress).reduce((s, p) => s + p.correctCount, 0);
  const totalAnswered = Object.values(progress).reduce(
    (s, p) => s + p.correctCount + p.incorrectCount,
    0
  );

  return {
    attempted: attempted.length,
    mastered: mastered.length,
    total: poems.length,
    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
  };
}
