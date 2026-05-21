/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VirtualPDF } from '../types';
import { virtualPDFs } from '../data/pdfs';
import { BookOpen, Search, ArrowLeft, ArrowRight, ChevronRight, FileText, Bookmark } from 'lucide-react';

interface PdfViewerProps {
  initialPdfId?: string;
  initialPageNumber?: number;
  onClose?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  initialPdfId,
  initialPageNumber,
  onClose
}) => {
  // 状態管理
  const [selectedPdfId, setSelectedPdfId] = useState<string>(initialPdfId || virtualPDFs[0].id);
  const [currentPageNum, setCurrentPageNum] = useState<number>(initialPageNumber || 1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const selectedPdf = virtualPDFs.find(p => p.id === selectedPdfId) || virtualPDFs[0];
  const currentPage = selectedPdf.pages.find(p => p.pageNumber === currentPageNum) || selectedPdf.pages[0];

  // 外部からの初期指定が変わった時の同期
  useEffect(() => {
    if (initialPdfId) {
      setSelectedPdfId(initialPdfId);
    }
    if (initialPageNumber) {
      setCurrentPageNum(initialPageNumber);
    }
  }, [initialPdfId, initialPageNumber]);

  // PDF変えた時は1ページ目にする
  const handlePdfChange = (id: string) => {
    setSelectedPdfId(id);
    setCurrentPageNum(1);
    setSearchQuery('');
  };

  const handlePrevPage = () => {
    if (currentPageNum > 1) {
      setCurrentPageNum(currentPageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageNum < selectedPdf.pages.length) {
      setCurrentPageNum(currentPageNum + 1);
    }
  };

  // 全PDFから、検索語に一致するページを割り出す
  const searchResults: { pdf: VirtualPDF, pageNum: number, title: string, quote: string }[] = [];
  if (searchQuery.trim().length > 1) {
    const q = searchQuery.toLowerCase();
    virtualPDFs.forEach(pdf => {
      pdf.pages.forEach(p => {
        if (p.content.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)) {
          const idx = p.content.toLowerCase().indexOf(q);
          const excerpt = p.content.substring(Math.max(0, idx - 15), Math.min(p.content.length, idx + 35));
          searchResults.push({
            pdf,
            pageNum: p.pageNumber,
            title: p.title,
            quote: `...${excerpt}...`
          });
        }
      });
    });
  }

  // 検索語のマッチ箇所のハイライト
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</mark> 
            : part
        )}
      </span>
    );
  };

  return (
    <div id="pdf-viewer-root" className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] min-h-[500px]">
      
      {/* 左サイドバー：PDF選択 ＆ 目次 ＆ 内検索 */}
      <div id="pdf-sidebar" className={`lg:col-span-1 bg-white border border-blue-100 rounded-[32px] p-5 flex flex-col shadow-sm ${sidebarOpen ? 'block' : 'hidden lg:flex'}`}>
        <div className="mb-4">
          <h3 className="text-sm font-black text-slate-900 mb-2.5 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-600" />
            資料・PDFライブラリ名
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {virtualPDFs.map(pdf => (
              <button
                key={pdf.id}
                id={`pdf-list-btn-${pdf.id}`}
                onClick={() => handlePdfChange(pdf.id)}
                className={`w-full text-left font-sans text-xs p-3 rounded-2xl border transition-all cursor-pointer ${
                  selectedPdfId === pdf.id 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-black shadow-xs ring-1 ring-blue-200' 
                    : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-blue-300'
                }`}
              >
                <div className="font-extrabold truncate">{pdf.title}</div>
                <div className="text-[10px] text-slate-500 font-bold mt-1">
                  種類: {pdf.type === 'past_exam' ? '📋 過去問PDF' : '📖 参考資料'} | {pdf.pages.length} ページ
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 検索フォーム */}
        <div className="mb-4 border-t border-blue-50 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              id="pdf-search-input"
              type="text"
              placeholder="PDF内の解説や公式を検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2.5 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-bold"
            />
          </div>
        </div>

        {/* 検索結果、または目次の一覧 */}
        <div className="flex-1 overflow-y-auto max-h-[250px] lg:max-h-none border-t border-blue-50 pt-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2.5">
            {searchQuery.trim().length > 1 ? '検索結果' : 'このPDFのページ目次'}
          </h4>

          {searchQuery.trim().length > 1 ? (
            <div id="pdf-search-results" className="grid grid-cols-1 gap-2">
              {searchResults.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-2 text-center">見つかりませんでした。別のキーワードで検索してください。</div>
              ) : (
                searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedPdfId(res.pdf.id);
                      setCurrentPageNum(res.pageNum);
                    }}
                    className="w-full text-left p-2.5 hover:bg-[#F0F6FF] border border-blue-100/50 rounded-xl transition-all cursor-pointer"
                  >
                    <div className="text-[10px] font-black text-blue-600 truncate">{res.pdf.title}</div>
                    <div className="text-xs font-bold text-slate-800 truncate mt-0.5">p.{res.pageNum} {res.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 line-clamp-2 bg-slate-50/50 p-1 rounded font-sans leading-tight">{res.quote}</div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div id="pdf-table-of-contents" className="grid grid-cols-1 gap-1">
              {selectedPdf.pages.map(page => (
                <button
                  key={page.pageNumber}
                  id={`pdf-toc-page-btn-${page.pageNumber}`}
                  onClick={() => setCurrentPageNum(page.pageNumber)}
                  className={`w-full flex items-center justify-between text-xs p-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                    currentPageNum === page.pageNumber 
                      ? 'bg-blue-600 text-white font-black' 
                      : 'hover:bg-[#F0F6FF] text-slate-700 font-medium'
                  }`}
                >
                  <span className="truncate pr-2">p.{page.pageNumber} {page.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右メイン領域：デジタルペーパー（PDFビューア） */}
      <div id="pdf-content-area" className="lg:col-span-3 bg-[#fdfcfa] border border-[#E2E8F0] rounded-[32px] flex flex-col shadow-sm overflow-hidden">
        {/* PDFの上部ツールバー */}
        <div className="bg-[#f0ece3]/80 border-b border-[#E2E8F0] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-800 fill-amber-100" />
            <h2 id="pdf-viewer-title" className="text-sm md:text-base font-extrabold text-amber-900 truncate max-w-xs md:max-w-md">
              {selectedPdf.title}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              id="pdf-prev-page-btn"
              onClick={handlePrevPage}
              disabled={currentPageNum === 1}
              className="p-1.5 px-3.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-black transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-xs"
            >
              前へ
            </button>
            <span id="pdf-page-indicator" className="text-xs font-mono font-black text-amber-900 bg-amber-100/50 px-2 py-1 rounded-md">
              {currentPageNum} / {selectedPdf.pages.length}
            </span>
            <button
              id="pdf-next-page-btn"
              onClick={handleNextPage}
              disabled={currentPageNum === selectedPdf.pages.length}
              className="p-1.5 px-3.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-black transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-xs"
            >
              次へ
            </button>
          </div>
        </div>

        {/* PDF紙面本体（教科書風の上品なデザイン） */}
        <div id="pdf-paper-sheet" className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6 font-sans">
            <div className="border-b border-amber-250 pb-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-amber-850 bg-amber-100 px-2.5 py-1 rounded-full font-black text-center">
                PAGE {currentPageNum}
              </span>
              <h1 className="text-lg md:text-xl font-bold text-slate-800 mt-3">
                {currentPage.title}
              </h1>
            </div>

            {/* 本文テキスト。検索一致をハイライト */}
            <div className="text-sm md:text-base text-slate-700 leading-relaxed font-sans space-y-4 whitespace-pre-wrap">
              {highlightText(currentPage.content, searchQuery)}
            </div>

            {/* 関連図：アスキー図解 */}
            {currentPage.diagram && (
              <div className="p-4 bg-slate-900 text-green-450 font-mono text-xs rounded-2xl overflow-x-auto shadow-inner leading-normal border-2 border-slate-800">
                <div className="text-slate-400 text-[10px] border-b border-slate-800 pb-1 mb-2 font-sans select-none font-bold">
                  [ 視覚的イメージ図解 / アスキー回路・ベクトル図 ]
                </div>
                {currentPage.diagram}
              </div>
            )}

            {/* 数式または重要公式 */}
            {currentPage.formulas && currentPage.formulas.length > 0 && (
              <div className="bg-amber-50/50 border border-amber-200/50 p-5 rounded-2xl space-y-2.5 shadow-xs">
                <h4 className="text-xs uppercase tracking-wider font-extrabold text-amber-800 flex items-center gap-1.5">
                  📚 このページの重要定理・公式
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {currentPage.formulas.map((form, idx) => (
                    <div key={idx} className="bg-white px-3 py-2 rounded-xl border border-amber-100 shadow-xs font-mono text-xs md:text-sm text-slate-800 text-center font-bold">
                      {form}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* ボトムメッセージ */}
            <div className="text-[11px] text-slate-400 text-center italic pt-8 select-none">
              ー {selectedPdf.title} p.{currentPageNum} (デジタル解説集) ー
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
