import React, { useState, useEffect } from 'react';
import { History, Plus } from 'lucide-react';
import { HistorySidebar } from './components/HistorySidebar';
import { InputSection } from './components/InputSection';
import { SummaryDisplay } from './components/SummaryDisplay';
import { generateSummaryFromUrl, generateSummaryFromTranscript } from './services/geminiService';
import {
  createFolder,
  deleteFolder,
  getApiKey,
  getFolders,
  getRememberApiKey,
  getSummaries,
  getSummariesForFolder,
  moveSummaryToFolder,
  reorderSummaryInFolder,
  saveSummary,
  setApiKey,
  setRememberApiKey,
  deleteSummary,
  DEFAULT_FOLDER_ID,
  type HistoryFolder
} from './utils/storage';
import { ExtraContextFile, VideoSummary, SummarizeMode, GeminiModel, SummaryOptions } from './types';

type QueueStatus = 'pending' | 'running' | 'done' | 'error';

type QueueItem = {
  id: string;
  value: string;
  submitMode: SummarizeMode;
  model: GeminiModel;
  options: SummaryOptions;
  folderId: string;
  status: QueueStatus;
  errorMessage?: string;
};

export default function App() {
  const [history, setHistory] = useState<VideoSummary[]>([]);
  const [currentSummary, setCurrentSummary] = useState<VideoSummary | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnlistedError, setIsUnlistedError] = useState(false);
  const [mode, setMode] = useState<SummarizeMode>('url');
  const [apiKey, setApiKeyState] = useState('');
  const [rememberApiKey, setRememberApiKeyState] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [folders, setFolders] = useState<HistoryFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState(DEFAULT_FOLDER_ID);
  const [queueTargetFolderId, setQueueTargetFolderId] = useState(DEFAULT_FOLDER_ID);

  useEffect(() => {
    setHistory(getSummaries());
    setFolders(getFolders());
    const remembered = getRememberApiKey();
    setRememberApiKeyState(remembered);
    if (remembered) {
      setApiKeyState(getApiKey());
    }

    // Preserve previous behavior: sidebar visible by default on desktop.
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  const queueStats = {
    pending: queue.filter(q => q.status === 'pending').length,
    running: queue.filter(q => q.status === 'running').length,
    done: queue.filter(q => q.status === 'done').length,
    error: queue.filter(q => q.status === 'error').length,
  };

  useEffect(() => {
    // When switching folders and nothing is queued, keep the queue target aligned
    // so bulk summaries land where the user is currently working.
    if (queueStats.pending === 0 && queueStats.running === 0) {
      setQueueTargetFolderId(activeFolderId);
    }
  }, [activeFolderId, queueStats.pending, queueStats.running]);

  const refreshHistory = () => {
    setHistory(getSummaries());
    setFolders(getFolders());
  };

  useEffect(() => {
    const runningCount = queueStats.running;
    const available = 2 - runningCount;
    if (available <= 0) return;

    const next = queue.filter(q => q.status === 'pending').slice(0, available);
    if (next.length === 0) return;

    next.forEach((item) => {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'running', errorMessage: undefined } : q));

      (async () => {
        try {
          let result;
          if (item.submitMode === 'url') {
            result = await generateSummaryFromUrl(item.value, item.model, item.options, apiKey);
          } else {
            result = await generateSummaryFromTranscript(item.value, item.model, item.options, apiKey);
          }

          const newSummary: VideoSummary = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            sourceType: item.submitMode,
            sourceValue: item.submitMode === 'url' ? item.value : item.value.substring(0, 100) + '...',
            model: item.model,
            outputLanguage: item.options.outputLanguage,
            hasExtraContext: !!(item.options.extraContextText || item.options.extraContextFile),
            folderId: item.folderId || DEFAULT_FOLDER_ID,
            ...result
          };

          saveSummary(newSummary);
          setHistory(getSummaries());

          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
        } catch (err: any) {
          console.error(err);
          const message = err?.message === 'UNLISTED_VIDEO_ERROR'
            ? 'Video is unlisted/restricted (use Transcript mode)'
            : 'Failed to generate summary';
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMessage: message } : q));
        }
      })();
    });
  }, [queue, queueStats.running, apiKey]);

  const handleSummarizeManyUrls = (
    items: Array<{ url: string; contextText?: string; extraContextFile?: ExtraContextFile }>,
    model: GeminiModel,
    baseOptions: SummaryOptions,
    folderId: string
  ) => {
    const cleaned = items
      .map(i => ({
        url: i.url.trim(),
        contextText: (i.contextText ?? '').trim(),
        extraContextFile: i.extraContextFile,
      }))
      .filter(i => !!i.url);

    if (cleaned.length === 0) return;

    const queueItems: QueueItem[] = cleaned.map((i) => ({
      id: crypto.randomUUID(),
      value: i.url,
      submitMode: 'url' as const,
      model,
      options: {
        ...baseOptions,
        // In bulk mode, context is per-summary (use per-item values only).
        extraContextText: i.contextText || undefined,
        extraContextFile: i.extraContextFile,
      },
      folderId: folderId || DEFAULT_FOLDER_ID,
      status: 'pending' as const,
    } as QueueItem));

    if (items.length === 0) return;

    setError(null);
    setIsUnlistedError(false);
    setQueue(prev => [...prev, ...queueItems]);
  };

  const handleSummarizeManyTranscripts = (
    transcripts: Array<{ transcript: string; contextText?: string; extraContextFile?: ExtraContextFile }>,
    model: GeminiModel,
    baseOptions: SummaryOptions,
    folderId: string
  ) => {
    const cleaned = transcripts
      .map(t => ({
        transcript: t.transcript.trim(),
        contextText: (t.contextText ?? '').trim(),
        extraContextFile: t.extraContextFile,
      }))
      .filter(t => !!t.transcript);
    if (cleaned.length === 0) return;

    const items: QueueItem[] = cleaned.map((t) => ({
      id: crypto.randomUUID(),
      value: t.transcript,
      submitMode: 'transcript' as const,
      model,
      options: {
        ...baseOptions,
        // In bulk mode, context is per-summary (use the per-transcript context only).
        extraContextText: t.contextText || undefined,
        extraContextFile: t.extraContextFile,
      },
      folderId: folderId || DEFAULT_FOLDER_ID,
      status: 'pending' as const,
    } as QueueItem));

    setError(null);
    setIsUnlistedError(false);
    setQueue(prev => [...prev, ...items]);
  };

  const handleSummarize = async (
    value: string, 
    submitMode: SummarizeMode, 
    model: GeminiModel,
    options: SummaryOptions
  ) => {
    setIsLoading(true);
    setError(null);
    setIsUnlistedError(false);
    setCurrentSummary(null);

    try {
      let result;
      if (submitMode === 'url') {
        result = await generateSummaryFromUrl(value, model, options, apiKey);
      } else {
        result = await generateSummaryFromTranscript(value, model, options, apiKey);
      }

      const newSummary: VideoSummary = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        sourceType: submitMode,
        sourceValue: submitMode === 'url' ? value : value.substring(0, 100) + '...',
        model: model,
        outputLanguage: options.outputLanguage,
        hasExtraContext: !!(options.extraContextText || options.extraContextFile),
        ...result
      };

      saveSummary(newSummary);
      setHistory(getSummaries());
      setCurrentSummary(newSummary);
    } catch (err: any) {
      console.error(err);
      if (err.message === "UNLISTED_VIDEO_ERROR") {
        setIsUnlistedError(true);
        setMode('transcript'); // Auto-switch to transcript mode
        setError("This video appears to be unlisted, private, or age-restricted. Switched to manual transcript mode.");
      } else {
        setError("Failed to generate summary. Please check your API key or try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (summary: VideoSummary) => {
    setCurrentSummary(summary);
    setError(null);
    setIsUnlistedError(false);
  };

  const handleDeleteHistory = (id: string) => {
    const updated = deleteSummary(id);
    setHistory(updated);
    if (currentSummary?.id === id) {
      setCurrentSummary(null);
    }
  };

  const handleCreateFolder = (name: string) => {
    const created = createFolder(name);
    if (!created) return;
    refreshHistory();
    setActiveFolderId(created.id);
  };

  const handleDeleteFolder = (folderId: string) => {
    deleteFolder(folderId);
    refreshHistory();
    if (activeFolderId === folderId) {
      setActiveFolderId(DEFAULT_FOLDER_ID);
    }
  };

  const handleMoveSummaryToFolder = (summaryId: string, folderId: string) => {
    moveSummaryToFolder(summaryId, folderId);
    refreshHistory();
  };

  const handleReorderSummary = (folderId: string, summaryId: string, direction: 'up' | 'down') => {
    reorderSummaryInFolder(folderId, summaryId, direction);
    // Pull the sorted view back into state (so UI updates immediately)
    const all = getSummaries();
    setHistory(all);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Open history"
            >
              <History size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">TubeSumm AI</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 flex-1 justify-center px-4">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                const next = e.target.value;
                setApiKeyState(next);
                if (rememberApiKey) {
                  setApiKey(next);
                }
              }}
              placeholder="Gemini API Key"
              className="w-full max-w-[360px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              disabled={isLoading}
              autoComplete="off"
              spellCheck={false}
            />
            <label className="flex items-center gap-2 text-sm text-slate-400 select-none">
              <input
                type="checkbox"
                checked={rememberApiKey}
                onChange={(e) => {
                  const next = e.target.checked;
                  setRememberApiKeyState(next);
                  setRememberApiKey(next);
                  if (next) {
                    setApiKey(apiKey);
                  } else {
                    // token is cleared by setRememberApiKey(false)
                  }
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500/50"
                disabled={isLoading}
              />
              Remember
            </label>
          </div>
          
          <button 
            onClick={() => {
                setCurrentSummary(null);
                setError(null);
                setIsUnlistedError(false);
                setMode('url');
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Summary</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Mobile token row */}
        <div className="md:hidden border-t border-slate-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                const next = e.target.value;
                setApiKeyState(next);
                if (rememberApiKey) {
                  setApiKey(next);
                }
              }}
              placeholder="Gemini API Key"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              disabled={isLoading}
              autoComplete="off"
              spellCheck={false}
            />
            <label className="flex items-center gap-2 text-sm text-slate-400 select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={rememberApiKey}
                onChange={(e) => {
                  const next = e.target.checked;
                  setRememberApiKeyState(next);
                  setRememberApiKey(next);
                  if (next) {
                    setApiKey(apiKey);
                  }
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500/50"
                disabled={isLoading}
              />
              Remember
            </label>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 relative flex">
        <HistorySidebar 
          summaries={getSummariesForFolder(activeFolderId)}
          allSummaries={history}
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={setActiveFolderId}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveSummaryToFolder={handleMoveSummaryToFolder}
          onReorderSummary={handleReorderSummary}
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
          activeId={currentSummary?.id}
        />

        <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-80' : ''}`}>
          
          {/* Default View / Input */}
          {!currentSummary && !isLoading && (
            <div className="max-w-4xl mx-auto pt-8 md:pt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Summarize Videos with AI
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  Paste a YouTube URL or transcript to get a detailed breakdown, chapters, and insights in seconds.
                </p>
              </div>

              <InputSection 
                onSummarize={handleSummarize} 
                onSummarizeManyUrls={handleSummarizeManyUrls}
                onSummarizeManyTranscripts={handleSummarizeManyTranscripts}
                isLoading={isLoading} 
                mode={mode}
                setMode={setMode}
                queueStats={{ pending: queueStats.pending, running: queueStats.running }}
                folders={folders}
                queueTargetFolderId={queueTargetFolderId}
                setQueueTargetFolderId={setQueueTargetFolderId}
              />
              
              {isUnlistedError && (
                 <div className="max-w-3xl mx-auto bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 p-4 rounded-xl flex items-start gap-3">
                    <div className="mt-0.5">⚠️</div>
                    <div>
                        <p className="font-semibold">Unlisted / Restricted Video Detected</p>
                        <p className="text-sm text-yellow-200/80 mt-1">
                            The app has automatically switched to <strong>Transcript mode</strong>. 
                            Please follow the instructions above to copy the transcript from YouTube.
                        </p>
                    </div>
                 </div>
              )}

              {error && !isUnlistedError && (
                <div className="max-w-3xl mx-auto bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl text-center">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
             <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
                <div className="relative w-24 h-24">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-mono text-indigo-400 animate-pulse">AI</span>
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-medium text-white">Analyzing Video Content</h3>
                    <p className="text-slate-500">Extracting chapters and generating insights...</p>
                </div>
             </div>
          )}

          {/* Result View */}
          {currentSummary && !isLoading && (
            <SummaryDisplay data={currentSummary} />
          )}

        </main>
      </div>
    </div>
  );
}