/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpacedRepetitionState, StudyLog, Problem, Discipline } from '../types';

// 初期状態のジェネレータ
export function createInitialState(problemId: string, initialTags: string[] = []): SpacedRepetitionState {
  return {
    problemId,
    interval: 0, // 未学習
    easeFactor: 2.5,
    repetitions: 0,
    lastStudied: 0,
    dueDate: 0, // 今すぐ解くべき
    customTags: initialTags,
    notes: ''
  };
}

/**
 * SuperMemo-2 (SM-2) アルゴリズムによる分散学習スケジュールの更新
 * @param state 現状のSRステート
 * @param rating 自己評価 1〜5
 * @returns 新しいSRステート
 */
export function calculateNextState(
  state: SpacedRepetitionState,
  rating: 1 | 2 | 3 | 4 | 5
): SpacedRepetitionState {
  const now = Date.now();
  let interval: number;
  let repetitions = state.repetitions;
  let easeFactor = state.easeFactor;

  // 1. 回答が不正解・あるいは全くダメだった場合 (Rating < 3)、間隔をリセット
  if (rating < 3) {
    repetitions = 0;
    // 間隔は0.5日 (12時間後) または1日にリセット。ここでは1日とします。
    interval = 1; 
  } else {
    // 2. 正解（Rating >= 3）の場合、間隔を広げる
    if (repetitions === 0) {
      interval = 1; // 1日後
    } else if (repetitions === 1) {
      interval = 3; // 通常版は6日だが、こまめに復習させるため3日に設定
    } else {
      interval = Math.round(state.interval * easeFactor);
    }
    repetitions += 1;
  }

  // 3. easeFactor (学習の容易さ係数) の更新
  // ratingが低いほどEFactorが減少し（次回すぐ復習）、高いと増加する
  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3; // 最小値制限
  }

  // 4. 次回日程の決定 (現在時刻 + interval日)
  const oneDayMs = 24 * 60 * 60 * 1000;
  const dueDate = now + interval * oneDayMs;

  return {
    ...state,
    interval,
    easeFactor,
    repetitions,
    lastStudied: now,
    dueDate
  };
}

// ローカルストレージキー
const STORAGE_KEYS = {
  SR_STATES: 'study_sr_states_v1',
  LOGS: 'study_logs_v1'
};

// データの読み込み
export function loadSRStates(): Record<string, SpacedRepetitionState> {
  const json = localStorage.getItem(STORAGE_KEYS.SR_STATES);
  return json ? JSON.parse(json) : {};
}

export function saveSRStates(states: Record<string, SpacedRepetitionState>): void {
  localStorage.setItem(STORAGE_KEYS.SR_STATES, JSON.stringify(states));
}

export function loadStudyLogs(): StudyLog[] {
  const json = localStorage.getItem(STORAGE_KEYS.LOGS);
  return json ? JSON.parse(json) : [];
}

export function saveStudyLogs(logs: StudyLog[]): void {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

/**
 * 次のアクション問題を選定する (Next Action Engine)
 * @param problems 全問題データ
 * @param states 現在のSRステート辞書
 * @param activeDiscipline 現在選択されている分野 ('energy_manager' | 'denken_1')
 */
export interface NextActionRecommendation {
  type: 'review' | 'new' | 'completed';
  problem: Problem | null;
  state: SpacedRepetitionState | null;
  message: string;
}

export function recommendNextAction(
  problems: Problem[],
  states: Record<string, SpacedRepetitionState>,
  activeDiscipline: Discipline
): NextActionRecommendation {
  const now = Date.now();
  const filteredProblems = problems.filter(p => p.discipline === activeDiscipline);

  if (filteredProblems.length === 0) {
    return {
      type: 'completed',
      problem: null,
      state: null,
      message: '該当する問題がありません。'
    };
  }

  // 1) 期限が切れている、あるいは今日復習すべき問題（復習。dueDate <= now）
  const reviewQueue = filteredProblems
    .map(p => ({
      problem: p,
      state: states[p.id] || createInitialState(p.id, p.defaultTags)
    }))
    .filter(item => item.state.lastStudied > 0 && item.state.dueDate <= now + 2 * 60 * 60 * 1000) // 誤差考慮：2時間以内も含む
    .sort((a, b) => a.state.dueDate - b.state.dueDate); // 期限が古いものほど最優先

  if (reviewQueue.length > 0) {
    return {
      type: 'review',
      problem: reviewQueue[0].problem,
      state: reviewQueue[0].state,
      message: '【復習タイム】前回の記憶が薄れるベストタイミングです！この弱点を改善しましょう。'
    };
  }

  // 2) まだ一度も学習していない問題
  const newQueue = filteredProblems
    .map(p => ({
      problem: p,
      state: states[p.id] || createInitialState(p.id, p.defaultTags)
    }))
    .filter(item => item.state.lastStudied === 0);

  if (newQueue.length > 0) {
    return {
      type: 'new',
      problem: newQueue[0].problem,
      state: newQueue[0].state,
      message: '【新規学習】次に解くべき新しい問題です。まずはここから一歩を踏み出してみましょう！'
    };
  }

  // 3) 全て学習済みで、かつ今日の復習も完了している。しかし今後復習予定が入っている
  const futureQueue = filteredProblems
    .map(p => ({
      problem: p,
      state: states[p.id] || createInitialState(p.id, p.defaultTags)
    }))
    .sort((a, b) => a.state.dueDate - b.state.dueDate);

  if (futureQueue.length > 0) {
    const nextDue = futureQueue[0].state.dueDate;
    const diffHrs = Math.max(0, Math.round((nextDue - now) / (1000 * 60 * 60)));
    const nextTimeStr = diffHrs > 24 
      ? `約 ${Math.round(diffHrs / 24)} 日後` 
      : `${diffHrs} 時間後`;

    return {
      type: 'completed',
      problem: futureQueue[0].problem,
      state: futureQueue[0].state,
      message: `今日の学習・復習は完璧に完了しています！素晴らしい進捗です🎊
（次の復習予定は ${nextTimeStr} です。さらに学びたいときは、下の全問題一覧から復習するか、上流の参考PDF資料を読みましょう！）`
    };
  }

  return {
    type: 'completed',
    problem: null,
    state: null,
    message: '今日の学習ミッションは完了です！'
  };
}
