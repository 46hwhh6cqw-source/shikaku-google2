/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Problem, SpacedRepetitionState, Choice } from '../types';
import { BookOpen, HelpCircle, CheckCircle, XCircle, ChevronRight, Tag, Save, ArrowLeft, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProblemCardProps {
  problem: Problem;
  state: SpacedRepetitionState;
  onAnswerSubmitted: (rating: 1 | 2 | 3 | 4 | 5, isCorrect: boolean, notes: string, customTags: string[], duration?: number) => void;
  onOpenPdf: (pdfId: string, pageNumber: number) => void;
  onBack?: () => void;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({
  problem,
  state,
  onAnswerSubmitted,
  onOpenPdf,
  onBack
}) => {
  // 状態管理
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [explanationMode, setExplanationMode] = useState<'friendly' | 'expert'>('friendly');
  const [notes, setNotes] = useState<string>(state.notes || '');
  const [tagInput, setTagInput] = useState<string>('');
  const [customTags, setCustomTags] = useState<string[]>(state.customTags || []);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [duration, setDuration] = useState<number>(0);

  // 問題が切り替わったらステートをリセット
  useEffect(() => {
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setShowHint(false);
    setExplanationMode('friendly');
    setNotes(state.notes || '');
    setCustomTags(state.customTags || []);
    setRating(null);
    setStartTime(Date.now());
    setDuration(0);
  }, [problem, state]);

  const handleChoiceSelect = (choiceId: string) => {
    if (isAnswered) return;
    setSelectedChoiceId(choiceId);
    setIsAnswered(true);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    setDuration(elapsed > 0 ? elapsed : 1);

    const isCorrect = problem.choices.find(c => c.id === choiceId)?.isCorrect || false;
    // デフォルトで、正解したらRating=4、不正解ならRating=2
    setRating(isCorrect ? 4 : 2);
  };

  const handleRatingSubmit = (selectedRating: 1 | 2 | 3 | 4 | 5) => {
    const isCorrect = problem.choices.find(c => c.id === selectedChoiceId)?.isCorrect || false;
    onAnswerSubmitted(selectedRating, isCorrect, notes, customTags, duration);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tagInput.trim();
    if (cleanTag && !customTags.includes(cleanTag)) {
      setCustomTags([...customTags, cleanTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setCustomTags(customTags.filter((_, i) => i !== indexToRemove));
  };

  const currentChoice = problem.choices.find(c => c.id === selectedChoiceId);
  const isCorrect = currentChoice?.isCorrect || false;

  return (
    <div id={`problem-card-${problem.id}`} className="bg-white rounded-[32px] shadow-md border border-blue-100 p-6 md:p-8 max-w-4xl mx-auto">
      {/* 上部ヘッダー（戻るボタン、分野、カテゴリ、タグ） */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-blue-50 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              id="back-to-list-btn"
              onClick={onBack}
              className="p-2.5 hover:bg-slate-50 border border-slate-100 rounded-xl text-slate-500 transition-colors cursor-pointer"
              title="一覧に戻る"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-lg">
              {problem.discipline === 'energy_manager' ? '🔋 エネルギー管理士' : '🔌 電験一種'}
            </span>
            <span className="text-xs font-mono font-black px-3 py-1 bg-orange-50 text-orange-600 rounded-lg">
              {problem.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            学習状況: {state.repetitions > 0 ? `復習 ${state.repetitions} 回目` : '未学習'}
          </span>
        </div>
      </div>

      {/* 問題名 */}
      <h2 id="problem-title" className="text-xl md:text-2xl font-black text-slate-900 mb-4 tracking-tight leading-snug">
        {problem.name}
      </h2>

      {/* タグリスト */}
      <div id="problem-tags-container" className="flex flex-wrap gap-1.5 mb-6">
        {customTags.map((tag, i) => (
          <span
            key={`tag-${i}`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-blue-50/50 hover:bg-blue-50 text-blue-800 rounded-full font-bold border border-blue-100/50"
          >
            <Tag className="w-3.5 h-3.5 text-blue-500" />
            {tag}
            {isAnswered && (
              <button
                type="button"
                className="hover:text-red-500 focus:outline-none font-black text-sm pl-1 ml-0.5"
                onClick={() => handleRemoveTag(i)}
                title="タグを削除"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {/* 問題文 */}
      <div id="problem-question-text" className="bg-[#F0F6FF]/60 rounded-2xl p-5 md:p-6 mb-6 text-slate-900 leading-relaxed text-base md:text-lg whitespace-pre-wrap font-bold border-l-4 border-blue-600 shadow-inner">
        {problem.question}
      </div>

      {/* ヒント機能 */}
      <div className="mb-6">
        {!showHint ? (
          <button
            id="show-hint-btn"
            onClick={() => setShowHint(true)}
            className="inline-flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors py-2 px-4 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100/80 cursor-pointer"
          >
            <Lightbulb className="w-4 h-4 text-orange-500 fill-orange-100" />
            ヒントを見る
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-orange-50 border border-orange-100 rounded-2xl text-slate-800 text-sm leading-relaxed"
          >
            <p className="font-black text-orange-700 mb-1 flex items-center gap-1">
              <Lightbulb className="w-4 h-4 text-orange-500 fill-orange-200 animate-bounce" />
              考え方のヒント：
            </p>
            {problem.hint}
          </motion.div>
        )}
      </div>

      {/* 選択肢セクション */}
      <div id="choices-container" className="grid grid-cols-1 gap-3.5 mb-8">
        {problem.choices.map((choice) => {
          let buttonClass = "w-full text-left p-4 rounded-2xl border-2 transition-all font-sans text-base flex justify-between items-center ";
          let checkIcon = null;

          if (!isAnswered) {
            buttonClass += "border-slate-200/80 bg-white hover:border-blue-500 hover:bg-blue-50/30 hover:scale-[1.01] active:bg-blue-50/40 text-slate-800 font-bold cursor-pointer shadow-xs";
          } else {
            buttonClass += "cursor-default ";
            if (choice.isCorrect) {
              // 正解の選択肢
              buttonClass += "border-green-500 bg-green-50 text-green-900 font-black shadow-sm";
              checkIcon = <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />;
            } else if (selectedChoiceId === choice.id) {
              // 間違えて選んだ選択肢
              buttonClass += "border-red-500 bg-red-50 text-red-900 font-black";
              checkIcon = <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
            } else {
              // 選ばなかった不正解の選択肢
              buttonClass += "border-slate-100 bg-slate-50/50 text-slate-400";
            }
          }

          return (
            <button
              key={choice.id}
              id={`choice-btn-${choice.id}`}
              onClick={() => handleChoiceSelect(choice.id)}
              disabled={isAnswered}
              className={buttonClass}
            >
              <span className="leading-snug pr-4">{choice.text}</span>
              {checkIcon}
            </button>
          );
        })}
      </div>

      {/* 解答後の解説 ＆ 自己評価 ＆ メモ */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-t border-blue-100 pt-6"
          >
            {/* マルバツ判定表示 */}
            <div id="results-banner" className={`flex items-center gap-4 p-5 rounded-2xl mb-6 ${
              isCorrect ? 'bg-green-50 text-green-900 border border-green-200 shadow-sm' : 'bg-red-50 text-red-900 border border-red-200 shadow-sm'
            }`}>
              {isCorrect ? (
                <>
                  <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
                  <div>
                    <h3 className="font-black text-lg">正解！素晴らしい！</h3>
                    <p className="text-xs text-green-700 font-medium mt-0.5">理屈がちゃんと頭に入っているか、下の解説で確認しましょう！</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-8 h-8 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-black text-lg">おっと、違いました！</h3>
                    <p className="text-xs text-red-700 font-medium mt-0.5">間違えたときこそ最も記憶が定着します。やさしい解説を読んでみましょう！</p>
                  </div>
                </>
              )}
            </div>

            {/* 解説のタブ切り替え（中学生向け vs 専門家向け） */}
            <div id="explanation-tabs-header" className="flex border border-blue-100 mb-5 bg-[#F0F6FF]/80 p-1.5 rounded-2xl">
              <button
                id="friendly-tab-btn"
                onClick={() => setExplanationMode('friendly')}
                className={`flex-1 py-3 px-4 text-center text-sm font-black rounded-xl transition-all cursor-pointer ${
                  explanationMode === 'friendly'
                    ? 'bg-white text-blue-700 shadow-sm scale-[1.01]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                👶 中学生でもわかる超やさしい解説
              </button>
              <button
                id="expert-tab-btn"
                onClick={() => setExplanationMode('expert')}
                className={`flex-1 py-3 px-4 text-center text-sm font-black rounded-xl transition-all cursor-pointer ${
                  explanationMode === 'expert'
                    ? 'bg-white text-blue-700 shadow-sm scale-[1.01]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🎓 専門的な詳しい解説
              </button>
            </div>

            {/* 解説文章ビュー */}
            <div id="explanation-content" className="prose prose-slate max-w-none text-slate-900 font-medium text-sm md:text-base leading-relaxed p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-6 whitespace-pre-wrap">
              {explanationMode === 'friendly' ? problem.friendlyExplanation : problem.expertExplanation}
            </div>

            {/* 資料PDFなどの関連リンク */}
            <div id="referenced-resources-container" className="bg-[#F0F6FF] border border-blue-100 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    情報源 (関連PDF) にジャンプ
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    公式・解説資料の解説をさらに詳しく読めます。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                {problem.pdfFileName && (
                  <button
                    id="open-past-pdf-btn"
                    onClick={() => onOpenPdf(problem.pdfFileName, problem.pdfPage)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-xl shadow-xs border border-blue-200 transition-colors cursor-pointer"
                  >
                    📝 過去問 PDF p.{problem.pdfPage}
                  </button>
                )}
                {problem.referenceDocId && (
                  <button
                    id="open-reference-pdf-btn"
                    onClick={() => onOpenPdf(problem.referenceDocId, problem.referenceDocPage)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-black px-4 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-xs transition-transform hover:scale-105 cursor-pointer"
                  >
                    📖 公式資料 PDF p.{problem.referenceDocPage}
                  </button>
                )}
              </div>
            </div>

            {/* タグ追加フォーム & メモ入力 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-t border-blue-50 pt-6">
              {/* メモ */}
              <div id="notes-container">
                <label className="block text-sm font-black text-slate-800 mb-2 flex items-center gap-1.5">
                  ✏️ 自分だけの学習メモ
                </label>
                <textarea
                  id="problem-notes-input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="覚えた語呂合わせ、注意すべき自分のクセなどをメモしよう。"
                  className="w-full text-sm p-4 border border-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-all placeholder:text-slate-400 font-medium"
                />
              </div>

              {/* タグ追加 */}
              <div id="tags-form-container">
                <label className="block text-sm font-black text-slate-800 mb-2 flex items-center gap-1.5">
                  🏷️ カテゴリ・タグを追加
                </label>
                <form onSubmit={handleAddTag} className="flex gap-2 mb-3">
                  <input
                    id="new-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="例: 計算ミス, 重要, 後半"
                    className="flex-1 text-sm px-4 py-3 border border-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-bold"
                  />
                  <button
                    type="submit"
                    id="add-tag-btn"
                    className="px-5 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl text-sm font-black transition-colors cursor-pointer"
                  >
                    追加
                  </button>
                </form>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  タグを付けると、データ分析ページで「どのタグが苦手か」自動的にマッピングして一目で把握できます。
                </p>
              </div>
            </div>

            {/* 分散学習スケジューラ：自己評価パネル */}
            <div id="rating-panel-container" className="bg-[#F0F6FF]/80 border border-blue-100 rounded-[28px] p-5 md:p-6 text-center shadow-inner">
              <h4 className="font-extrabold text-blue-900 text-base md:text-lg mb-1 flex items-center justify-center gap-1.5">
                🧠 次回の復習スケジュールを決定（自己評価）
              </h4>
              <p className="text-xs text-slate-600 font-medium mb-4 max-w-lg mx-auto">
                あなたの体感的な「難しさ・定着度」を教えてください。忘却曲線システムが、次回復習すべき最適なタイミングを割り出し、最優先メニューに組み込みます。
              </p>

              <div id="rating-buttons" className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { rating: 1 as const, color: 'hover:bg-red-50 hover:border-red-400 text-red-800 bg-white border-red-200/50', label: '1. 全然ダメ', desc: 'ちんぷんかんぷん' },
                  { rating: 2 as const, color: 'hover:bg-orange-50 hover:border-orange-400 text-orange-850 bg-white border-orange-200/50', label: '2. まあまあ', desc: 'うろ覚え/間違えた' },
                  { rating: 3 as const, color: 'hover:bg-yellow-50 hover:border-yellow-400 text-yellow-850 bg-white border-yellow-250/50', label: '3. なんとか', desc: '苦労して正解' },
                  { rating: 4 as const, color: 'hover:bg-blue-50 hover:border-blue-400 text-blue-800 bg-white border-blue-200/50', label: '4. スラスラ', desc: 'スムーズに正解' },
                  { rating: 5 as const, color: 'hover:bg-green-50 hover:border-green-400 text-green-800 bg-white border-green-200/50', label: '5. 完璧！', desc: '他人に説明できる' }
                ].map((item) => (
                  <button
                    key={`rating-${item.rating}`}
                    id={`rating-btn-${item.rating}`}
                    onClick={() => handleRatingSubmit(item.rating)}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer ${item.color}`}
                  >
                    <span className="text-sm font-black font-sans">{item.label}</span>
                    <span className="text-[10px] opacity-90 font-bold font-sans mt-1 mt-auto leading-tight">{item.desc}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-center items-center gap-1.5 text-xs text-slate-500 font-medium mt-4">
                <span>※ 科学的忘却曲線アルゴリズムが自動で次回予定日を割り出します。</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
