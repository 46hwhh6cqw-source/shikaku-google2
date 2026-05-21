/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Problem, SpacedRepetitionState, StudyLog } from '../types';
import { Award, Brain, BarChart2, Calendar, CheckCircle, Flame, Star, AlertTriangle, ListFilter, Clock, Check, X, GraduationCap } from 'lucide-react';

interface DashboardProps {
  problems: Problem[];
  states: Record<string, SpacedRepetitionState>;
  logs: StudyLog[];
  onSelectProblem: (id: string) => void;
  onClearData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  problems,
  states,
  logs,
  onSelectProblem,
  onClearData
}) => {
  // --- 1. 基本スタッツの算出 ---

  // 全問題数
  const totalCount = problems.length;

  // 学習開始した問題（少なくとも1回回答済み）
  const studiedIds = useMemo(() => {
    return Object.keys(states).filter(id => states[id] && states[id].lastStudied > 0);
  }, [states]);

  const studiedCount = studiedIds.length;
  const progressPercent = totalCount > 0 ? Math.round((studiedCount / totalCount) * 100) : 0;

  // 完璧に脳に定着した問題 (Repetitions >= 3)
  const masteredCount = useMemo(() => {
    return studiedIds.filter(id => {
      const s = states[id];
      return s && s.repetitions >= 3;
    }).length;
  }, [studiedIds, states]);

  // 今日の復習対象問題数（DueDateが本日以前）
  const now = Date.now();
  const dueCount = useMemo(() => {
    return problems.filter(p => {
      const s = states[p.id];
      return s && s.lastStudied > 0 && s.dueDate <= now;
    }).length;
  }, [problems, states, now]);

  // 現在の連続学習日数（ストリーク）の算出
  const streak = useMemo(() => {
    if (logs.length === 0) return 0;
    const dateStrings = Array.from(new Set(
      logs.map(log => new Date(log.timestamp).toLocaleDateString())
    )) as string[];
    const uniqueDates = dateStrings.map(d => new Date(d));

    uniqueDates.sort((a, b) => b.getTime() - a.getTime()); // 新しい順

    let count = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (uniqueDates.length > 0) {
      const lastLogDate = uniqueDates[0];
      lastLogDate.setHours(0,0,0,0);
      
      if (lastLogDate.getTime() !== today.getTime() && lastLogDate.getTime() !== yesterday.getTime()) {
        return 0;
      }

      let checkDate = lastLogDate;
      count = 1;

      for (let i = 1; i < uniqueDates.length; i++) {
        const d = uniqueDates[i];
        d.setHours(0,0,0,0);
        
        const expectedDate = new Date(checkDate);
        expectedDate.setDate(expectedDate.getDate() - 1);

        if (d.getTime() === expectedDate.getTime()) {
          count++;
          checkDate = d;
        } else if (d.getTime() < expectedDate.getTime()) {
          break;
        }
      }
    }
    return count;
  }, [logs]);

  // --- 2. 解答時間（秒）の分析 ---
  const durationStats = useMemo(() => {
    const validLogs = logs.filter(l => l.duration !== undefined);
    if (validLogs.length === 0) {
      return { avgSec: 0, minSec: 0, maxSec: 0, comment: '問題に解答するとここにタイムが表示されます！' };
    }
    const durations = validLogs.map(l => l.duration as number);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avgSec = Math.round(sum / durations.length);
    const minSec = Math.min(...durations);
    const maxSec = Math.max(...durations);

    // 中学生向けのユニークなコメント
    let comment = 'じっくり考えて正確に解けています。素晴らしいです！';
    if (avgSec < 10) {
      comment = '超スピード解答！電光石火のひらめき力です！';
    } else if (avgSec < 25) {
      comment = 'ちょうど良いリズムで解けています。この調子！';
    } else if (avgSec > 60) {
      comment = 'あきらめずに深く考える粘り強さがあり、学習効果がとても高いです！';
    }

    return { avgSec, minSec, maxSec, comment };
  }, [logs]);

  // 直近8回の解答時間の履歴（棒グラフ用）
  const recentDurs = useMemo(() => {
    const validLogs = logs.filter(l => l.duration !== undefined);
    return validLogs.slice().slice(-8).map((l, idx) => {
      const prob = problems.find(p => p.id === l.problemId);
      return {
        index: idx + 1,
        sec: l.duration || 0,
        isCorrect: l.isCorrect,
        name: prob ? prob.name.split('：')[1] || prob.name : '問題'
      };
    });
  }, [logs, problems]);

  // --- 3. 分野別正答率 (Category Correct Rate) ---
  const fieldAnalytics = useMemo(() => {
    const list = ['電気回路', '自動制御', '電気の基礎', '情報処理', '電磁気 (理論)', '電気機器・制御'];
    const dataMap: Record<string, { total: number; correct: number }> = {};
    
    list.forEach(f => {
      dataMap[f] = { total: 0, correct: 0 };
    });

    // ログから分野ごとに集計
    logs.forEach(log => {
      const prob = problems.find(p => p.id === log.problemId);
      if (prob) {
        const cat = prob.category || 'その他';
        if (!dataMap[cat]) {
          dataMap[cat] = { total: 0, correct: 0 };
        }
        dataMap[cat].total += 1;
        if (log.isCorrect) {
          dataMap[cat].correct += 1;
        }
      }
    });

    return Object.keys(dataMap).map(field => {
      const { total, correct } = dataMap[field];
      const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        field,
        total,
        correct,
        rate
      };
    }).filter(d => d.total > 0 || problems.some(p => p.category === d.field));
  }, [problems, logs]);

  // --- 4. 正誤バランス円グラフ (SVG環型) ---
  const accuracyMetrics = useMemo(() => {
    const totalAnswers = logs.length;
    const correctCount = logs.filter(l => l.isCorrect).length;
    const incorrectCount = totalAnswers - correctCount;
    const accuracyPercent = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
    return {
      totalAnswers,
      correctCount,
      incorrectCount,
      accuracyPercent
    };
  }, [logs]);

  // 最も正解率が低い苦手分野の判定
  const weakestField = useMemo(() => {
    const answeredFields = fieldAnalytics.filter(f => f.total > 0);
    if (answeredFields.length === 0) return null;
    return answeredFields.slice().sort((a,b) => a.rate - b.rate)[0];
  }, [fieldAnalytics]);

  // 苦手タグの選定（平均自己Ratingが低く、回答ログのあるもの）
  const weakestTag = useMemo(() => {
    const metrics: Record<string, { count: number; sumRating: number; problemIds: string[] }> = {};
    problems.forEach(p => {
      const s = states[p.id];
      const customTags = s ? s.customTags : p.defaultTags;
      const pLogs = logs.filter(l => l.problemId === p.id);
      if (pLogs.length > 0) {
        customTags.forEach(tag => {
          if (!metrics[tag]) {
            metrics[tag] = { count: 0, sumRating: 0, problemIds: [] };
          }
          pLogs.forEach(log => {
            metrics[tag].count += 1;
            metrics[tag].sumRating += log.rating;
          });
          if (!metrics[tag].problemIds.includes(p.id)) {
            metrics[tag].problemIds.push(p.id);
          }
        });
      }
    });

    return Object.keys(metrics).map(tag => {
      const avg = metrics[tag].count > 0 ? Number((metrics[tag].sumRating / metrics[tag].count).toFixed(2)) : 0;
      return {
        tag,
        count: metrics[tag].count,
        avgRating: avg,
        pIds: metrics[tag].problemIds
      };
    }).sort((a, b) => a.avgRating - b.avgRating)[0] || null;
  }, [problems, states, logs]);

  // --- 5. 中学生に向けた学習アドバイス作成 ---
  const studyAdvice = useMemo(() => {
    if (studiedCount === 0) {
      return {
        status: 'start',
        title: '🌱 学習をはじめよう！',
        text: 'まだ問題を解いていません！ホーム画面のおすすめ問題から、おもしろい解説クイズに挑戦してみましょう！'
      };
    }
    if (dueCount > 0) {
      return {
        status: 'review',
        title: '⏰ 脳の復習タイミング発生中！',
        text: `今日は ${dueCount} 問の復習スケジュールがあります。忘却曲線スケジュールに合わせて復習すると、一回覚えたことが一生忘れないレベルになります！`
      };
    }
    if (weakestField && weakestField.rate < 60) {
      return {
        status: 'weak',
        title: `⚠️ 苦手な分野 『${weakestField.field}』 をはっけん！`,
        text: `『${weakestField.field}』の正答率が ${weakestField.rate}% と少し低くなっています。中学生向けの「噛み砕き解説」や、解説の中にある「参考用PDF」を読んで、理屈をゆっくり理解してみましょう！`
      };
    }
    return {
      status: 'excellent',
      title: '✨ 完ぺきな進捗ペースです！',
      text: '今日の復習クエストはゼロ！学習したことがしっかりとあなたの頭に定着しています。新しい問題に挑戦するか、資料を読んで得意を極めましょう。'
    };
  }, [studiedCount, dueCount, weakestField]);

  return (
    <div id="dashboard-analyzer-view" className="space-y-8">
      
      {/* 1. 中学生向け 応援アドバイスパネル */}
      <div id="advisor-advice-card" className={`p-6 rounded-[28px] border-2 shadow-sm ${
        studyAdvice.status === 'review' ? 'bg-amber-50 border-amber-200 text-slate-800' :
        studyAdvice.status === 'weak' ? 'bg-red-50/60 border-red-200 text-slate-800' :
        'bg-green-50 border-green-200 text-slate-800'
      }`}>
        <div className="flex gap-4 items-start">
          <div className="p-3 bg-white rounded-2xl shadow-xs shrink-0">
            <Brain className={`w-7 h-7 ${
              studyAdvice.status === 'review' ? 'text-amber-500 animate-bounce' :
              studyAdvice.status === 'weak' ? 'text-red-500 animate-pulse' :
              'text-green-500'
            }`} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base md:text-lg mb-1 flex items-center gap-2">
              <span>学習アドバイザーの分析</span>
              {studyAdvice.status === 'weak' && <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-black">要ニガテ克服</span>}
              {studyAdvice.status === 'review' && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-black">復習のチャンス</span>}
            </h3>
            <h4 className="text-sm font-bold text-slate-700 mb-1.5">{studyAdvice.title}</h4>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-semibold">{studyAdvice.text}</p>
          </div>
        </div>
      </div>

      {/* 2. 4連クイックスタッツグリッド */}
      <div id="quick-stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 進捗率 */}
        <div className="bg-white rounded-[24px] border border-blue-50 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">解いた問題の割合</div>
            <div className="text-lg md:text-xl font-black text-blue-900 font-mono">{progressPercent}%</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">{studiedCount}問 / 全{totalCount}問</div>
          </div>
        </div>

        {/* 定着数 */}
        <div className="bg-white rounded-[24px] border border-blue-50 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">脳にインプット済み</div>
            <div className="text-lg md:text-xl font-black text-green-950 font-mono">{masteredCount} 問</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">3回以上くり返しクリア</div>
          </div>
        </div>

        {/* 復習待ち */}
        <div className="bg-white rounded-[24px] border border-blue-50 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">今日の復習が必要</div>
            <div className="text-lg md:text-xl font-black text-amber-900 font-mono">{dueCount} 問</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">忘れたころにやると効果的</div>
          </div>
        </div>

        {/* 平均解答時間 */}
        <div className="bg-white rounded-[24px] border border-blue-50 p-5 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-2xl bg-[#EEF2F6] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">1問平均スピード</div>
            <div className="text-lg md:text-xl font-black text-slate-900 font-mono">{durationStats.avgSec}秒</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">早いほど脳に定着！</div>
          </div>
        </div>
      </div>

      {/* 3. グラフ：分野別正答率 ＆ 正誤比率ドーナツ（視覚的） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左側2カラム：分野別(カテゴリー)正答率の表示 (中学生にも分かりやすい色分け) */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-blue-100 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <h3 className="font-extrabold text-slate-900 text-sm md:text-base flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-blue-600" />
                分野（カテゴリー）ごとの正答率
              </h3>
              <p className="text-xs text-slate-400 font-bold">※正しくあてられた比率です</p>
            </div>

            <div className="space-y-4">
              {fieldAnalytics.map((stat, idx) => {
                const colorTheme = stat.rate >= 80 ? { bar: 'bg-green-500', text: 'text-green-700 bg-green-50/50' } :
                                   stat.rate >= 50 ? { bar: 'bg-blue-500', text: 'text-blue-700 bg-blue-50/50' } :
                                   stat.rate > 0 ? { bar: 'bg-orange-400', text: 'text-orange-700 bg-orange-50/50' } :
                                   { bar: 'bg-slate-300', text: 'text-slate-500 bg-slate-50' };

                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                          💡 {stat.field}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          (回答 {stat.total}回中、{stat.correct}回正解)
                        </span>
                      </div>
                      {/* カスタムビジュアルバー */}
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                        <div className={`h-full ${colorTheme.bar} rounded-full transition-all duration-1000`} style={{ width: `${stat.total > 0 ? stat.rate : 0}%` }} />
                      </div>
                    </div>
                    {/* スコア割合 */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-xl ${colorTheme.text}`}>
                        {stat.total > 0 ? `${stat.rate}%` : '未解答'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {weakestField && (
            <div className="mt-6 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500 flex items-center gap-2">
              <span className="p-1 px-2 bg-red-150 text-red-800 rounded-lg text-[10px] shrink-0">ニガテアドバイス</span>
              <span>
                『{weakestField.field}』の正答率が最も低いです。優先的にこの分野の問題に取り組んで、正解率を100%に近づけましょう！
              </span>
            </div>
          )}
        </div>

        {/* 右1カラム：正誤判定割合サークル(ドーナツ型パイチャート) */}
        <div id="accuracy-circular-panel" className="bg-white rounded-[32px] border border-blue-100 p-6 shadow-xs flex flex-col items-center justify-between">
          <div className="w-full">
            <h3 className="font-extrabold text-slate-900 text-xs md:text-sm mb-4 flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              通算の正誤比率（せいごバランス）
            </h3>
          </div>

          <div className="relative w-36 h-36 flex items-center justify-center my-4 overflow-visible">
            {logs.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 text-slate-400 text-xs italic">
                <span>解答後にここに</span>
                <span>グラフが描かれます</span>
              </div>
            ) : null}
            
            <svg className="w-full h-full transform -rotate-90 scale-x-[-1]" viewBox="0 0 120 120">
              {/* グレー（アウターサークル） */}
              <circle
                cx="60"
                cy="60"
                r="45"
                stroke="#EEF2F6"
                strokeWidth="12"
                fill="none"
              />
              
              {accuracyMetrics.totalAnswers > 0 && (
                <>
                  {/* 赤：まちがえた数分 */}
                  <circle
                    cx="60"
                    cy="60"
                    r="45"
                    stroke="#EF4444"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset="0"
                  />
                  {/* 緑：正解した数分 */}
                  <circle
                    cx="60"
                    cy="60"
                    r="45"
                    stroke="#22C55E"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - accuracyMetrics.accuracyPercent / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                </>
              )}
            </svg>

            {/* 中心部テキスト */}
            <div className="absolute text-center">
              <div className="text-2xl md:text-3xl font-black text-slate-800 font-mono tracking-tighter">
                {accuracyMetrics.accuracyPercent}%
              </div>
              <div className="text-[10px] text-slate-400 font-black tracking-wider mt-0.5">
                せいかいりつ
              </div>
            </div>
          </div>

          {/* 解説凡例（中学生向け） */}
          <div className="w-full space-y-2 border-t border-slate-100 pt-4 text-xs font-bold">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
                せいかい（正解数）
              </span>
              <span className="text-green-600 text-right">{accuracyMetrics.correctCount} 問</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block" />
                まちがい（不正解数）
              </span>
              <span className="text-red-500 text-right">{accuracyMetrics.incorrectCount} 問</span>
            </div>
            <div className="text-[10px] text-slate-400 text-center pt-2 italic">
              あきらめずに取り組めば緑の輪が広がります！
            </div>
          </div>
        </div>

      </div>

      {/* 4. 解答時間推移グラフ (最新8ログの推移 - SVG 棒グラフ自作) */}
      <div id="duration-speed-history-chart" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左2列：解答にかかった時間(スピード)の推移棒グラフ */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-blue-100 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
            <h3 className="font-extrabold text-slate-900 text-sm md:text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              最近の解答スピード（解答時間）のグラフ
            </h3>
            <span className="text-xs text-slate-400 font-mono">（直近8回・秒数表示）</span>
          </div>

          {recentDurs.length === 0 ? (
            <div className="text-slate-400 italic text-xs py-14 text-center font-bold">
              まだ解答データがありません。過去問に回答すると、かかった秒数がグラフに記録されます！
            </div>
          ) : (
            <div>
              {/* 自作お洒落SVG 棒グラフ */}
              <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="relative h-44 w-full flex items-end justify-between gap-1 md:gap-3 px-2">
                  
                  {/* 横グリッド線 */}
                  <div className="absolute top-0 left-0 w-full border-b border-dashed border-slate-200" />
                  <div className="absolute top-1/4 left-0 w-full border-b border-dashed border-slate-200" />
                  <div className="absolute top-2/4 left-0 w-full border-b border-dashed border-slate-200" />
                  <div className="absolute top-3/4 left-0 w-full border-b border-dashed border-slate-200" />

                  {recentDurs.map((d, index) => {
                    // 最大を一旦 60秒 として割り算でスケールさせる
                    const maxBound = Math.max(60, ...recentDurs.map(r => r.sec));
                    const heightPercent = Math.max(8, Math.min(100, Math.round((d.sec / maxBound) * 100)));
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center group relative z-5">
                        {/* ツールチップを表示 */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] p-1.5 px-2.5 rounded-lg shadow-sm whitespace-nowrap pointer-events-none font-bold z-10 text-center">
                          <p className="truncate max-w-[124px] text-[8px] font-medium">{d.name}</p>
                          <p className="text-amber-400 font-mono">{d.sec}秒 ({d.isCorrect ? 'せいかい' : 'まちがい'})</p>
                        </div>

                        {/* 棒本体 */}
                        <div className="text-[10px] font-black text-slate-500 font-mono mb-1 text-center shrink-0">
                          {d.sec}s
                        </div>
                        <div 
                          className={`w-4 md:w-8 rounded-t-lg transition-all duration-1000 ${
                            d.isCorrect 
                              ? 'bg-emerald-400 hover:bg-emerald-500 shadow-emerald-100 shadow-md' 
                              : 'bg-rose-400 hover:bg-rose-500 shadow-rose-100 shadow-md'
                          }`}
                          style={{ height: `${heightPercent * 1.2}px` }}
                        />
                        
                        <div className="text-[10px] font-mono font-bold text-slate-400 mt-2">
                          #{d.index}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-between text-[11px] font-bold text-slate-500 mt-3 select-none">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" />正解したときの時間</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-400 rounded-sm" />まちがえたときの時間</span>
              </div>
            </div>
          )}
        </div>

        {/* 右1列：タイムアドバイザーメッセージ */}
        <div className="bg-white rounded-[32px] border border-blue-100 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-extrabold text-[#1E3A8A] text-xs md:text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-orange-500" />
              解答のスピードのアドバイス
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              電気の計算問題は、式を早く立てられるようになると、本番の試験でとっても余裕が生まれます。
            </p>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
              <p className="text-xs font-black text-slate-800">
                💡 現在の分析データ：
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <div className="text-slate-500">最も速い正解時間:</div>
                <div className="text-green-600 font-mono text-right">{durationStats.minSec > 0 ? `${durationStats.minSec}秒` : '-'}</div>
                <div className="text-slate-500">最も悩んだ時間:</div>
                <div className="text-slate-700 font-mono text-right">{durationStats.maxSec > 0 ? `${durationStats.maxSec}秒` : '-'}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-[11px] font-extrabold text-indigo-900 leading-normal">
            {durationStats.comment}
          </div>
        </div>

      </div>

      {/* 5. 苦手個別問題のクリックリスト */}
      {weakestTag && (
        <div id="weakest-problems-review-hub" className="bg-white rounded-[32px] border border-blue-100 p-6 shadow-xs">
          <h3 className="font-black text-slate-900 text-sm md:text-base flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500" />
            一番ニガテなタグ『#{weakestTag.tag}』が含まれる問題の克服リスト
          </h3>
          <p className="text-xs text-slate-500 font-semibold mb-4">
            このタグの問題で自己レベル評価が低いため、再度解き直して得意にしましょう！ボタンを押すと直接その問題を開きます。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weakestTag.pIds.map(pId => {
              const prob = problems.find(p => p.id === pId);
              if (!prob) return null;
              return (
                <div key={pId} className="p-3 border border-slate-150 hover:border-blue-400 bg-slate-50/50 rounded-2xl flex items-center justify-between gap-4">
                  <div className="truncate flex-1">
                    <p className="text-xs font-mono font-bold text-slate-400">{prob.category}</p>
                    <p className="text-xs font-black text-slate-800 truncate" title={prob.name}>{prob.name}</p>
                  </div>
                  <button
                    onClick={() => onSelectProblem(pId)}
                    className="p-2 px-4 text-[10px] font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl cursor-pointer"
                  >
                    この問題を解く
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 危険ゾーン：全学習データのリセット */}
      <div id="danger-zone" className="bg-red-50/20 border border-red-100 rounded-[24px] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-red-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            学習データの管理（リセット）
          </h4>
          <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
            この操作を行うと、これまでの回答ログ・解答時間、忘却スケジュールデータがすべてクリアされ、最初の未学習状態に戻ります。
          </p>
        </div>
        <button
          id="clear-logs-btn"
          onClick={() => {
            if (window.confirm('これまでの学習データをすべて消去します。よろしいですか？')) {
              onClearData();
            }
          }}
          className="px-5 py-3 text-xs font-black text-red-700 hover:text-white bg-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-2xl transition-all shadow-sm shrink-0 cursor-pointer"
        >
          データをリセットする
        </button>
      </div>

    </div>
  );
};
