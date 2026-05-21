/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 取得可能な分野の定義
export type Discipline = 'energy_manager' | 'denken_1';

// 分類 (科目/テーマ)
export interface Category {
  id: string;
  name: string;
  discipline: Discipline;
}

// 選択肢の型
export interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

// 問題の型
export interface Problem {
  id: string;
  discipline: Discipline;
  category: string; // 回路, 制御, 送配電 など
  name: string; // 「令和4年 問3 (1) 三相不平衡」など
  question: string; // 問題文 (Markdownや改行、数式を含む)
  choices: Choice[]; // 4択など
  expertExplanation: string; // 専門的なガチ解説
  friendlyExplanation: string; // 中学生レベルでもイメージで分かる超噛み砕き解説
  pdfFileName: string; // 参照過去問PDF名
  pdfPage: number; // 参照PDFページ数
  referenceDocId: string; // 参照公式・解説資料ID
  referenceDocPage: number; // 参照公式資料ページ数
  defaultTags: string[]; // 初期タグ
  hint: string; // ヒント
}

// ユーザーの学習履歴（進捗ログ）
export interface StudyLog {
  id: string;
  problemId: string;
  timestamp: number; // 回答日時
  rating: 1 | 2 | 3 | 4 | 5; // 自己評価 (1: 全然ダメ, 2: うる覚え/間違えた, 3: なんとか正解, 4: スムーズに正解, 5: 完璧・他人に説明できる)
  isCorrect: boolean; // 正解したか
  duration?: number; // 解答にかかった時間（秒）
}

// 分散学習（Spaced Repetition）のステート
export interface SpacedRepetitionState {
  problemId: string;
  interval: number; // 次回までの間隔（日数単位、0.5, 1, 3, 7, 14, 30, 60など）
  easeFactor: number; // SuperMemo-2のEFactor (初期値 2.5)
  repetitions: number; // 連続でクリア（Rating >= 3）した回数
  lastStudied: number; // 前回の学習タイムスタンプ
  dueDate: number; // 次回学習予定のタイムスタンプ
  customTags: string[]; // ユーザーが追加したタグ
  notes: string; // ユーザーのメモ
}

// 仮想PDF資料の型
export interface VirtualPDF {
  id: string; // 'past_exam_2023_q3', 'formula_control'
  title: string;
  type: 'past_exam' | 'reference_doc'; // 過去問PDF か 公式・解説資料PDF
  discipline: Discipline;
  pages: {
    pageNumber: number;
    title: string;
    content: string; // 面白い解説やテキスト
    diagram?: string; // アスキーアートや簡単なレイアウト用
    formulas?: string[]; // 関連主要公式
  }[];
}
