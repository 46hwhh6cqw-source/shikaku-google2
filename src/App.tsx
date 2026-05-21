/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { Problem, SpacedRepetitionState, StudyLog, Discipline } from './types';
import { problemsData } from './data/problems';
import { loadSRStates, saveSRStates, loadStudyLogs, saveStudyLogs, recommendNextAction, calculateNextState, createInitialState } from './utils/scheduler';
import { ProblemCard } from './components/ProblemCard';
import { PdfViewer } from './components/PdfViewer';
import { Dashboard } from './components/Dashboard';
import { TestSession } from './components/TestSession';
import { BookOpen, Brain, Calendar, CheckCircle2, ChevronRight, GraduationCap, LayoutDashboard, ListTodo, Star, Tag, RefreshCw, Sparkles, Clock, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // 1. 各種状態
  const [activeTab, setActiveTab ] = useState<'home' | 'dashboard' | 'reference'>('home');
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline>('energy_manager');
  const [states, setStates] = useState<Record<string, SpacedRepetitionState>>({});
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);

  // 検索・フィルタ関連状態
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // テストセッション関連状態
  const [testSession, setTestSession] = useState<{ active: boolean; questions: Problem[] } | null>(null);

  // PDFジャンプ用の一時状態
  const [jumpPdfId, setJumpPdfId] = useState<string | undefined>(undefined);
  const [jumpPdfPage, setJumpPdfPage] = useState<number | undefined>(undefined);

  // 2. マウント時にローカルストレージからデータを読み込む
  useEffect(() => {
    setStates(loadSRStates());
    setLogs(loadStudyLogs());
  }, []);

  // 3. データが変更されたらローカルストレージに自動保存
  const updateSRState = (problemId: string, rating: 1 | 2 | 3 | 4 | 5, isCorrect: boolean, notes: string, customTags: string[], duration?: number) => {
    setStates(prev => {
      const currentState = prev[problemId] || createInitialState(problemId);
      const nextState = calculateNextState(currentState, rating);
      nextState.notes = notes;
      nextState.customTags = customTags;

      const newStates = {
        ...prev,
        [problemId]: nextState
      };
      saveSRStates(newStates);
      return newStates;
    });

    setLogs(prev => {
      const newLog: StudyLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        problemId,
        timestamp: Date.now(),
        rating,
        isCorrect,
        duration
      };
      const newLogs = [...prev, newLog];
      saveStudyLogs(newLogs);
      return newLogs;
    });

    // 回答が終わったら、回答画面を閉じておすすめリストに戻す
    setCurrentProblem(null);
  };

  // テストの記録完了時に呼び出されるハンドラー
  const handleFinishTestSession = (sessionResults: { problemId: string; isCorrect: boolean; rating: 1 | 2 | 3 | 4 | 5; duration: number }[]) => {
    setStates(prev => {
      const newStates = { ...prev };
      sessionResults.forEach(res => {
        const currentState = prev[res.problemId] || createInitialState(res.problemId);
        const nextState = calculateNextState(currentState, res.rating);
        newStates[res.problemId] = nextState;
      });
      saveSRStates(newStates);
      return newStates;
    });

    setLogs(prev => {
      const newLogs = [...prev];
      sessionResults.forEach(res => {
        newLogs.push({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.round(Math.random() * 1000)}`,
          problemId: res.problemId,
          timestamp: Date.now(),
          rating: res.rating,
          isCorrect: res.isCorrect,
          duration: res.duration
        });
      });
      saveStudyLogs(newLogs);
      return newLogs;
    });

    setTestSession(null);
    setActiveTab('dashboard'); // 分析ダッシュボードで見せる
  };

  // 応用・全学習データのクリア
  const handleClearAllData = () => {
    localStorage.removeItem('study_sr_states_v1');
    localStorage.removeItem('study_logs_v1');
    setStates({});
    setLogs([]);
    setCurrentProblem(null);
  };

  // 解説からPDFジャンプへのナビゲーション橋渡し
  const handleOpenPdfFromProb = (pdfId: string, pageNumber: number) => {
    setJumpPdfId(pdfId);
    setJumpPdfPage(pageNumber);
    setActiveTab('reference'); // PDFタブへ移行
  };

  // 4. Next Action Engine によるお勧め選定
  const recommendation = useMemo(() => {
    return recommendNextAction(problemsData, states, activeDiscipline);
  }, [states, activeDiscipline]);

  // キーワード・タグによる絞り込みをかけた問題リスト
  const filteredProblems = useMemo(() => {
    let result = problemsData.filter(p => p.discipline === activeDiscipline);

    // 1. タグでの絞り込み
    if (selectedTag) {
      result = result.filter(p => {
        const scoreState = states[p.id];
        const tags = scoreState ? scoreState.customTags : p.defaultTags;
        return tags.includes(selectedTag);
      });
    }

    // 2. キーワードでの絞り込み
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        return (
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.question.toLowerCase().includes(query) ||
          p.friendlyExplanation.toLowerCase().includes(query) ||
          p.expertExplanation.toLowerCase().includes(query) ||
          p.defaultTags.some(t => t.toLowerCase().includes(query))
        );
      });
    }

    return result;
  }, [activeDiscipline, selectedTag, searchQuery, states]);

  // 分野でのフィルタリング (全問題の数把握用)
  const disciplineProblems = useMemo(() => {
    return problemsData.filter(p => p.discipline === activeDiscipline);
  }, [activeDiscipline]);

  // 全同一カテゴリ内のタグクラウド用を構築
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    const activeProbs = problemsData.filter(p => p.discipline === activeDiscipline);
    activeProbs.forEach(p => {
      const s = states[p.id];
      const tags = s ? s.customTags : p.defaultTags;
      tags.forEach(t => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [activeDiscipline, states]);

  // 各種ステータスラベルの整理
  const getProblemStatusString = (pId: string) => {
    const s = states[pId];
    if (!s || s.lastStudied === 0) return { label: '未学習', color: 'bg-slate-100 text-slate-600' };
    if (s.dueDate <= Date.now()) return { label: '復習待ち', color: 'bg-amber-100 text-amber-800 font-bold' };
    if (s.repetitions >= 3) return { label: '長期記憶・習得済', color: 'bg-green-100 text-green-800 font-medium' };
    return { label: '記憶安定中', color: 'bg-blue-100 text-blue-800' };
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-[#F0F6FF] text-[#1E293B] font-sans">
      
      {/* 上部ヘッダー（ナビゲーション） */}
      <header id="main-app-header" className="sticky top-0 z-10 bg-white border-b border-blue-100 shadow-sm px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* 左：アプリタイトル・コンセプト */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-100">
              ⚡
            </div>
            <div>
              <h1 id="app-brand-name" className="text-xl font-black text-blue-900 tracking-tight leading-none flex items-center gap-1.5">
                分散学習サポーター <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">SM-2</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                科学的な忘却曲線スケジュール基づく Fire HD 10 向け学習支援
              </p>
            </div>
          </div>

          {/* 中央：分野のスイッチ（エネ管 or 電験） */}
          <div id="discipline-selector" className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
            <button
              id="select-discipline-energy-manager"
              onClick={() => {
                setActiveDiscipline('energy_manager');
                setCurrentProblem(null);
              }}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeDiscipline === 'energy_manager'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🔋 エネルギー管理士
            </button>
            <button
              id="select-discipline-denken-1"
              onClick={() => {
                setActiveDiscipline('denken_1');
                setCurrentProblem(null);
              }}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeDiscipline === 'denken_1'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🔌 電験一種 (理論/機械)
            </button>
          </div>

          {/* 右：主機能タブ (Home, Dashboard, Reference) */}
          <nav id="main-navigation-tabs" className="flex gap-1 md:gap-2">
            {[
              { id: 'home' as const, label: '学習ホーム', icon: ListTodo },
              { id: 'dashboard' as const, label: 'データ分析', icon: LayoutDashboard },
              { id: 'reference' as const, label: '参考資料PDF', icon: BookOpen }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // 資料ページを初期状態から開く場合以外はジャンプパラメータをリセット
                    if (tab.id !== 'reference') {
                      setJumpPdfId(undefined);
                      setJumpPdfPage(undefined);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs md:text-sm font-bold rounded-2xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs font-bold ring-2 ring-blue-100'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        
        {/* テストセッション起動中、または個別問題解説中が最優先 */}
        {testSession ? (
          <TestSession
            problems={problemsData}
            logs={logs}
            onFinishTest={handleFinishTestSession}
            onCancel={() => setTestSession(null)}
          />
        ) : currentProblem ? (
          <div>
            <ProblemCard
              problem={currentProblem}
              state={states[currentProblem.id] || createInitialState(currentProblem.id, currentProblem.defaultTags)}
              onAnswerSubmitted={updateSRState}
              onOpenPdf={handleOpenPdfFromProb}
              onBack={() => setCurrentProblem(null)}
            />
          </div>
        ) : (
          <div>
            <AnimatePresence mode="wait">
              
              {/* --- タブ1: HOME (問題一覧 ＆ おすすめ Next Action) --- */}
              {activeTab === 'home' && (
                <motion.div
                  key="home-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  {/* 【最重要】Next Action 自動おすすめパネル：中学生基準、細かい判断は不要 */}
                  <section id="next-action-recommendation-sec" className="bg-blue-600 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-500/10 border border-blue-500">
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="space-y-3 max-w-2xl">
                        <span className="bg-blue-500/50 text-white text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-blue-400/20">
                          🎯 おすすめの学習
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-snug mt-2">
                          {recommendation.problem ? recommendation.problem.name : '今日の復習ミッション完了！'}
                        </h2>
                        <p className="text-xs md:text-sm text-blue-100 font-medium leading-relaxed">
                          {recommendation.message}
                        </p>
                      </div>

                      {recommendation.problem && (
                        <button
                          id="recommendation-action-btn"
                          onClick={() => setCurrentProblem(recommendation.problem)}
                          className="w-full md:w-auto px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                        >
                          学習をスタートする
                          <ChevronRight className="w-5 h-5 stroke-[3]" />
                        </button>
                      )}
                    </div>
                    {/* 背景の装飾サークル（あざやかなグラデーションデザイン） */}
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500 rounded-full opacity-65 blur-3xl pointer-events-none"></div>
                  </section>

                  {/* 10問ランダムミニテスト模擬試験セクション */}
                  {activeDiscipline === 'energy_manager' && (
                    <div id="test-session-launcher-box" className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-[28px] border-2 border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xs">
                      <div className="space-y-1.5 text-center md:text-left">
                        <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] px-3 py-1 font-black rounded-full uppercase tracking-wider">
                          <Compass className="w-3" /> 実力判定
                        </span>
                        <h3 className="text-base font-black text-indigo-950">🔋 科目Ⅱ ガチ10問ランダム実力模擬テスト</h3>
                        <p className="text-xs text-slate-500 font-bold leading-relaxed">
                          あなたの全回答履歴と苦手なカテゴリーを分析し、SM-2忘却曲線学習に基づいて最適な10問をセレクトして実力テストを行います！
                        </p>
                      </div>
                      <button
                        onClick={() => setTestSession({ active: true, questions: [] })}
                        className="w-full md:w-auto p-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-indigo-150 transform hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                      >
                        ⚡ テストをスタート
                      </button>
                    </div>
                  )}

                  {/* 検索・絞り込みコントロール */}
                  <div id="search-filter-panel" className="bg-white p-5 rounded-[28px] border border-blue-50/70 shadow-xs space-y-4">
                    {/* キーワードサーチボックス */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="キーワードで過去問を探す... (問題名、大カテゴリ、問題本文、解説などから検索)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-3.5 pl-11 pr-11 bg-slate-50 border-2 border-slate-150 focus:border-blue-500 focus:bg-white rounded-2xl text-xs md:text-sm font-semibold text-slate-800 transition-all outline-hidden"
                      />
                      <Compass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      {searchQuery.length > 0 && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                        >
                          消去
                        </button>
                      )}
                    </div>

                    {/* タグクラウド */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <span>タグでしぼりこむ (クリックしてON/OFF) :</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allTags.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">タグがありません</span>
                        ) : (
                          allTags.map((tag, idx) => {
                            const isSelected = selectedTag === tag;
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedTag(isSelected ? null : tag)}
                                className={`text-[11px] px-3.5 py-1.5 font-bold rounded-xl border-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-150 hover:border-slate-300'
                                }`}
                              >
                                #{tag}
                              </button>
                            );
                          })
                        )}
                        {(selectedTag || searchQuery) && (
                          <button
                            onClick={() => {
                              setSelectedTag(null);
                              setSearchQuery('');
                            }}
                            className="bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100 hover:border-red-200 text-[11px] px-3.5 py-1.5 font-black rounded-xl transition-all cursor-pointer"
                          >
                            × しぼりこみをリセット
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 全問題一覧セクション */}
                  <section id="problems-list-sec" className="space-y-5">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-blue-600" />
                        この分野の過去問リスト ({filteredProblems.length} / {disciplineProblems.length}問表示中)
                      </h3>
                      <p className="text-xs font-medium text-slate-500">※いつでも好きな問題を選択して学べます</p>
                    </div>

                    {filteredProblems.length === 0 ? (
                      <div className="p-12 text-center bg-white rounded-3xl border border-blue-50 text-slate-400 text-xs italic font-bold">
                        条件にあてはまる過去問が見つかりませんでした。別のキーワードやしぼりこみリセットをおためしください。
                      </div>
                    ) : (
                      <div id="problems-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredProblems.map(p => {
                        const scoreState = states[p.id];
                        const statusObj = getProblemStatusString(p.id);
                        const customTags = scoreState ? scoreState.customTags : p.defaultTags;

                        // 次回学習予定の日付計算
                        let dueText = 'いつでも可';
                        if (scoreState && scoreState.lastStudied > 0) {
                          const diffMs = scoreState.dueDate - Date.now();
                          if (diffMs <= 0) {
                            dueText = '今すぐ復習可能！';
                          } else {
                            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                            dueText = diffDays > 1 ? `あと ${diffDays} 日後` : '明日復習';
                          }
                        }

                        return (
                          <div
                            key={p.id}
                            id={`problem-row-${p.id}`}
                            className="bg-white rounded-[24px] p-6 border border-blue-50/50 hover:border-blue-400 transition-all flex flex-col justify-between shadow-xs hover:shadow-lg hover:scale-[1.01] cursor-pointer"
                            onClick={() => setCurrentProblem(p)}
                          >
                            <div className="space-y-4">
                              {/* 分類・ステータスバッジ */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#F0F6FF] text-blue-700 rounded-lg">
                                  {p.category}
                                </span>
                                <span className={`text-[11px] uppercase font-black px-2.5 py-0.5 rounded-full ${statusObj.color}`}>
                                  {statusObj.label}
                                </span>
                              </div>

                              {/* タイトル */}
                              <h4 className="font-extrabold text-slate-900 text-base md:text-lg leading-snug line-clamp-2">
                                {p.name}
                              </h4>

                              {/* タグクラウド */}
                              <div className="flex flex-wrap gap-1.5">
                                {customTags.map((t, idx) => (
                                  <span key={idx} className="text-xs px-2.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-full font-medium">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* ボトム：学習予定/回数 */}
                            <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-blue-500" />
                                復習スケジュール: <strong className={dueText.includes('今すぐ') ? 'text-amber-600 font-bold' : 'text-slate-800'}>{dueText}</strong>
                              </span>
                              <span className="flex items-center gap-0.5">
                                回答数: <strong className="text-slate-800 font-bold">{scoreState?.repetitions || 0}</strong> 回
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </section>
                </motion.div>
              )}

              {/* --- タブ2: DASHBOARD (分析画面) --- */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Dashboard
                    problems={problemsData}
                    states={states}
                    logs={logs}
                    onSelectProblem={(id) => {
                      const found = problemsData.find(p => p.id === id);
                      if (found) {
                        setCurrentProblem(found);
                        setActiveTab('home'); // HOMEのクイズフォーカスに戻す
                      }
                    }}
                    onClearData={handleClearAllData}
                  />
                </motion.div>
              )}

              {/* --- タブ3: REFERENCE (仮想PDFビューア) --- */}
              {activeTab === 'reference' && (
                <motion.div
                  key="reference-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <PdfViewer
                    initialPdfId={jumpPdfId}
                    initialPageNumber={jumpPdfPage}
                    onClose={() => {
                      setJumpPdfId(undefined);
                      setJumpPdfPage(undefined);
                      setActiveTab('home');
                    }}
                  />
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        )}

      </main>

      {/* フッター */}
      <footer id="main-app-footer" className="bg-slate-900 text-slate-400 py-10 px-4 mt-16 border-t border-slate-800 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <h3 className="text-white font-bold text-sm flex items-center justify-center md:justify-start gap-1">
              <span>🚀 記憶定着型・最強の電気資格学習アプリ</span>
            </h3>
            <p className="text-xs text-slate-500">
              このアプリは完全オフライン駆動。データはすべてあなたの実機（localStorage）に安全に保存されます。
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            &copy; 2026 分散学習サポーター. Built securely inside AI Studio on your Fire HD 10.
          </div>
        </div>
      </footer>

    </div>
  );
}

