/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Problem, StudyLog, Choice } from '../types';
import { Trophy, Clock, Check, X, ChevronRight, ArrowLeft, Brain, BookOpen, Star, AlertCircle, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TestSessionProps {
  problems: Problem[];
  logs: StudyLog[];
  onFinishTest: (sessionLogs: { problemId: string; isCorrect: boolean; rating: 1 | 2 | 3 | 4 | 5; duration: number }[]) => void;
  onCancel: () => void;
}

export const TestSession: React.FC<TestSessionProps> = ({
  problems,
  logs,
  onFinishTest,
  onCancel
}) => {
  // --- 1. 出題する10問の選定 (学習履歴と苦手分野に基づき抽出＆ランダム化) ---
  const selectedQuestions = useMemo(() => {
    const enekenProbs = problems.filter(p => p.discipline === 'energy_manager');
    if (enekenProbs.length <= 10) {
      // 10問以下の場合はシャッフルして全問返却
      return [...enekenProbs].sort(() => Math.random() - 0.5);
    }

    // 分野ごとの正答率の計算
    const fieldCorrectStats: Record<string, { total: number; correct: number }> = {};
    logs.forEach(l => {
      const prob = problems.find(p => p.id === l.problemId);
      if (prob && prob.discipline === 'energy_manager') {
        const cat = prob.category;
        if (!fieldCorrectStats[cat]) {
          fieldCorrectStats[cat] = { total: 0, correct: 0 };
        }
        fieldCorrectStats[cat].total++;
        if (l.isCorrect) {
          fieldCorrectStats[cat].correct++;
        }
      }
    });

    // 各問題に「弱点スコア（Priority）」を与える
    const weightedProbs = enekenProbs.map(prob => {
      let weight = 0.5 + Math.random() * 0.5; // 基本ランダム度

      // 過去にまちがえたログがあればスコア追加
      const probLogs = logs.filter(l => l.problemId === prob.id);
      const incorrectCount = probLogs.filter(l => !l.isCorrect).length;
      weight += incorrectCount * 1.5; // まちがえた回数が多いほど出やすい

      // 以前の平均Ratingが低ければスコア追加
      if (probLogs.length > 0) {
        const avgRate = probLogs.reduce((acc, curr) => acc + curr.rating, 0) / probLogs.length;
        if (avgRate < 3.0) {
          weight += (3.0 - avgRate) * 1.2;
        }
      } else {
        weight += 1.0; // 未学習の問題もチャンスを与える
      }

      // 苦手分野（正答率が低いカテゴリー）であればスコア追加
      const catStats = fieldCorrectStats[prob.category];
      if (catStats && catStats.total > 0) {
        const rate = catStats.correct / catStats.total;
        if (rate < 0.6) {
          weight += (1.0 - rate) * 1.8;
        }
      }

      return { prob, weight };
    });

    // スコアイウエイトが高い順にソートし、上位10問を抽出。
    // 出題順をシャッフル
    const top10 = weightedProbs
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map(wp => wp.prob);

    return top10.sort(() => Math.random() - 0.5);
  }, [problems, logs]);

  // --- States ---
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [explanationMode, setExplanationMode] = useState<'friendly' | 'expert'>('friendly');
  const [totalTime, setTotalTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [testResults, setTestResults] = useState<{ problemId: string; isCorrect: boolean; rating: 1 | 2 | 3 | 4 | 5; duration: number }[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // タイマー駆動
  useEffect(() => {
    if (isCompleted) return;
    const interval = setInterval(() => {
      setTotalTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted]);

  // 問題切り替え時のタイマーリセット＆状態クリア
  useEffect(() => {
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setExplanationMode('friendly');
    setQuestionStartTime(Date.now());
  }, [currentIndex]);

  const currentProblem = selectedQuestions[currentIndex];

  // 回答選択時
  const handleChoiceSelect = (choiceId: string) => {
    if (isAnswered) return;
    setSelectedChoiceId(choiceId);
    setIsAnswered(true);

    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const duration = elapsed > 0 ? elapsed : 1;

    const isCorrect = currentProblem.choices.find(c => c.id === choiceId)?.isCorrect || false;
    
    // 中学生向けの自動セルフレーティング（正解=SM2の4/スムーズに正解、不正解=2/間違えた）
    const rating: 1 | 2 | 3 | 4 | 5 = isCorrect ? 4 : 2;

    setTestResults(prev => [
      ...prev,
      {
        problemId: currentProblem.id,
        isCorrect,
        rating,
        duration
      }
    ]);
  };

  // 次へ進む
  const handleNext = () => {
    if (currentIndex < selectedQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  // テスト総合成績の算出
  const summary = useMemo(() => {
    const total = testResults.length;
    const correctCount = testResults.filter(r => r.isCorrect).length;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    let evaluation = '素晴らしい成績です！この調子で合格を目指そう！';
    if (rate >= 90) {
      evaluation = '天才的！科目Ⅱの極意を完ぺきにマスターしています！💮';
    } else if (rate >= 70) {
      evaluation = '合格圏内！よく勉強が定着しています。自信を持って！✨';
    } else if (rate >= 40) {
      evaluation = 'あと一歩！噛み砕き解説をよみ直してニガテを克服しよう！🚀';
    } else {
      evaluation = 'のびしろバツグン！毎日コツコツ復習すれば絶対にあがります！🌱';
    }

    return { total, correctCount, rate, evaluation };
  }, [testResults]);

  if (selectedQuestions.length === 0) {
    return (
      <div className="bg-white rounded-[32px] p-8 border border-blue-100 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
        <h3 className="text-lg font-black text-slate-800">エネルギー管理士の過去問が見つかりません。</h3>
        <p className="text-xs text-slate-500">データセットを確認してください。</p>
        <button onClick={onCancel} className="px-5 py-2 bg-blue-600 text-white font-black rounded-xl">ホームに戻る</button>
      </div>
    );
  }

  return (
    <div id="test-session-root" className="max-w-4xl mx-auto space-y-6">
      
      {/* 完了していないテストアクティブ画面 */}
      {!isCompleted ? (
        <div id="quiz-flow" className="bg-white rounded-[32px] border border-blue-100 p-6 md:p-8 shadow-sm">
          
          {/* ヘッダー指標 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-50 pb-4 mb-6">
            <div className="space-y-1">
              <span className="p-1 px-3 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase tracking-wider rounded-full">
                科目Ⅱ 10問実力テスト
              </span>
              <h2 className="text-base md:text-lg font-extrabold text-slate-800 flex items-center gap-2">
                <span>問題 {currentIndex + 1} / 10</span>
                <span className="text-xs text-slate-400 font-semibold">(分野: {currentProblem.category})</span>
              </h2>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                経過時間: <span className="font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded-md">{totalTime}秒</span>
              </span>
            </div>
          </div>

          {/* プログレスバー */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
            <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${(currentIndex + 1) * 10}%` }} />
          </div>

          {/* 問題文 */}
          <div className="space-y-4 mb-8">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-[20px] text-xs md:text-sm text-slate-800 leading-relaxed font-semibold">
              <div className="whitespace-pre-wrap">{currentProblem.question}</div>
            </div>
          </div>

          {/* 選択肢リスト */}
          <div className="space-y-3.5 mb-8">
            {currentProblem.choices.map((choice) => {
              const isSelected = selectedChoiceId === choice.id;
              let btnStyle = 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20';
              
              if (isAnswered) {
                if (choice.isCorrect) {
                  btnStyle = 'border-green-300 bg-green-50 text-green-950 font-black';
                } else if (isSelected) {
                  btnStyle = 'border-red-300 bg-red-50 text-red-950 font-black';
                } else {
                  btnStyle = 'border-slate-100 opacity-60 text-slate-400';
                }
              } else if (isSelected) {
                btnStyle = 'border-indigo-500 bg-indigo-50/50';
              }

              return (
                <button
                  key={choice.id}
                  disabled={isAnswered}
                  onClick={() => handleChoiceSelect(choice.id)}
                  className={`w-full p-4 text-left text-xs md:text-sm font-bold border-2 rounded-2xl transition-all flex items-center justify-between gap-4 cursor-pointer ${btnStyle}`}
                >
                  <span className="flex-1 leading-snug">{choice.text}</span>
                  {isAnswered && (
                    <span className="shrink-0">
                      {choice.isCorrect ? (
                        <span className="p-1 px-3 bg-green-100 text-green-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" /> 正解
                        </span>
                      ) : isSelected ? (
                        <span className="p-1 px-3 bg-red-100 text-red-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                          <X className="w-3 h-3 stroke-[3]" /> まちがい
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 解説表示（回答後） */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 border border-indigo-100 bg-[#EEF2F6]/50 rounded-[24px] space-y-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200/50 pb-2.5">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                    <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0" />
                    解説ガイド
                  </span>
                  {/* 解説レベルスイッチ */}
                  <div className="flex bg-white/60 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                    <button
                      onClick={() => setExplanationMode('friendly')}
                      className={`px-2.5 py-1 rounded-md font-bold ${explanationMode === 'friendly' ? 'bg-indigo-600 text-white font-black' : 'text-slate-500'}`}
                    >
                      中学生向け
                    </button>
                    <button
                      onClick={() => setExplanationMode('expert')}
                      className={`px-2.5 py-1 rounded-md font-bold ${explanationMode === 'expert' ? 'bg-indigo-600 text-white font-black' : 'text-slate-500'}`}
                    >
                      ガチ専門解説
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap">
                  {explanationMode === 'friendly' ? currentProblem.friendlyExplanation : currentProblem.expertExplanation}
                </div>

                {/* 次へ進む／完了ボタン */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <span>{currentIndex < selectedQuestions.length - 1 ? '次の問題へ' : '結果をみる！'}</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      ) : (
        /* 完了：リザルト画面 */
        <div id="test-results-completes" className="bg-white rounded-[32px] border border-blue-100 p-6 md:p-8 shadow-sm space-y-6">
          
          <div className="text-center space-y-3 border-b border-slate-100 pb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Trophy className="w-9 h-9 text-yellow-500 animate-bounce" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800">
              科目Ⅱ 10問実力テスト完了！
            </h2>
            <p className="text-xs font-bold text-slate-500">
              お疲れ様でした！実機への学習ログ書き込みを行います。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 得点カード */}
            <div className="p-5 rounded-2xl bg-[#EEF2F6] border border-indigo-50 text-center flex flex-col items-center justify-center space-y-1 shadow-xs">
              <p className="text-xs text-indigo-800 font-extrabold uppercase">回答結果</p>
              <h3 className="text-4xl font-extrabold text-indigo-950 font-mono tracking-tighter">
                {summary.correctCount} / {summary.total} <span className="text-xs text-indigo-700 font-black">問せーかい</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">正答率 {summary.rate}%</p>
            </div>

            {/* 時間測定 */}
            <div className="p-5 rounded-2xl bg-[#F0F6FF] border border-blue-50 text-center flex flex-col items-center justify-center space-y-1 shadow-xs">
              <p className="text-xs text-blue-800 font-extrabold uppercase">総かかった時間</p>
              <h3 className="text-4xl font-extrabold text-blue-950 font-mono tracking-tighter">
                {totalTime} <span className="text-xs text-blue-700 font-black">びょう</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">
                (1問平均: {Math.round(totalTime / summary.total)}秒)
              </p>
            </div>

            {/* 応援アドバイス */}
            <div className="p-5 rounded-2xl bg-green-50 border border-green-100 flex flex-col justify-center space-y-1.5 shadow-xs col-span-1 md:col-span-1">
              <p className="text-[10px] text-green-700 font-black uppercase">アドバイザーからの評価</p>
              <p className="text-xs font-bold text-slate-800 leading-normal">
                {summary.evaluation}
              </p>
            </div>

          </div>

          {/* 問題チェックリスト */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black text-slate-800">
              今回解いた問題のふりかえり
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
              {selectedQuestions.map((prob, idx) => {
                const res = testResults.find(r => r.problemId === prob.id);
                return (
                  <div key={prob.id} className="flex items-center justify-between gap-4 p-3 bg-white border border-slate-100 rounded-xl leading-none text-xs">
                    <div className="truncate flex-1">
                      <span className="text-[10px] font-mono text-slate-400 font-bold mr-1.5">第{idx+1}問</span>
                      <span className="font-bold text-slate-800 truncate" title={prob.name}>{prob.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-black p-1 px-2.5 rounded-lg ${
                        res?.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {res?.isCorrect ? '✅ せいかい' : '❌ まちがい'}
                      </span>
                      <span className="font-mono font-bold text-[11px] text-indigo-600">{res?.duration}秒</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ボトムボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={onCancel}
              className="px-5 py-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              回答を保存せずにもどる
            </button>
            <button
              onClick={() => onFinishTest(testResults)}
              className="px-6 py-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-md cursor-pointer"
            >
              回答ログを記録して終了する！
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
