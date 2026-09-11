export interface Poem {
  id: number;
  author: string;
  kamiNoKu: string;
  shimoNoKu: string;
  reading: string;
  translation: string;
}

export interface PoemProgress {
  correctCount: number;
  incorrectCount: number;
  streak: number;
  lastAnswered: number;
}

export type ProgressMap = Record<number, PoemProgress>;

export interface QuizQuestion {
  poem: Poem;
  options: string[];
  correctIndex: number;
}

export interface HyakuninOption {
  text: string;
  poemId: number;
  readingShimo: string; // 下の句のひらがな読み（スペースなし）
}

export interface HyakuninQuestion {
  poem: Poem;
  options: HyakuninOption[];
  correctIndex: number;
}
