import React, { useState, useRef } from 'react';
import { Youtube, FileText, Loader2, Play, Cpu, Info, Settings2, FileUp, X, Plus } from 'lucide-react';
import { SummarizeMode, GeminiModel, OutputLanguage, ExtraContextFile, SummaryOptions } from '../types';
import { DEFAULT_FOLDER_ID, type HistoryFolder } from '../utils/storage';

interface InputSectionProps {
  onSummarize: (value: string, mode: SummarizeMode, model: GeminiModel, options: SummaryOptions) => void;
  onSummarizeManyUrls: (
    items: Array<{ url: string; contextText?: string; extraContextFile?: ExtraContextFile }>,
    model: GeminiModel,
    options: SummaryOptions,
    folderId: string
  ) => void;
  onSummarizeManyTranscripts: (
    transcripts: Array<{ transcript: string; contextText?: string; extraContextFile?: ExtraContextFile }>,
    model: GeminiModel,
    options: SummaryOptions,
    folderId: string
  ) => void;
  isLoading: boolean;
  mode: SummarizeMode;
  setMode: (mode: SummarizeMode) => void;
  queueStats?: { pending: number; running: number };
  folders: HistoryFolder[];
  queueTargetFolderId: string;
  setQueueTargetFolderId: (folderId: string) => void;
}

export const InputSection: React.FC<InputSectionProps> = ({ onSummarize, onSummarizeManyUrls, onSummarizeManyTranscripts, isLoading, mode, setMode, queueStats, folders, queueTargetFolderId, setQueueTargetFolderId }) => {
  const [model, setModel] = useState<GeminiModel>('gemini-3-flash-preview');
  const [url, setUrl] = useState('');
  const [isMultiUrl, setIsMultiUrl] = useState(false);
  const [multiUrls, setMultiUrls] = useState<Array<{ url: string; contextText: string; extraContextFile?: ExtraContextFile; fileInputNonce: number }>>([
    { url: '', contextText: '', extraContextFile: undefined, fileInputNonce: 0 }
  ]);
  const [transcript, setTranscript] = useState('');
  const [multiTranscripts, setMultiTranscripts] = useState<Array<{ transcript: string; contextText: string; extraContextFile?: ExtraContextFile; fileInputNonce: number }>>([
    { transcript: '', contextText: '', extraContextFile: undefined, fileInputNonce: 0 }
  ]);
  const [isMultiTranscript, setIsMultiTranscript] = useState(false);
  
  // Advanced Options
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('auto');
  const [extraContextText, setExtraContextText] = useState('');
  const [extraContextFile, setExtraContextFile] = useState<ExtraContextFile | undefined>(undefined);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAsExtraContextFile = async (file: File): Promise<ExtraContextFile> => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File too large (Max 10MB)');
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const base64Data = dataUrl.split(',')[1];
    return {
      data: base64Data,
      mimeType: file.type,
      name: file.name,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options: SummaryOptions = {
      outputLanguage,
      extraContextText: extraContextText.trim() || undefined,
      extraContextFile
    };

    if (mode === 'url' && isMultiUrl) {
      const cleaned = multiUrls
        .map(i => ({
          url: i.url.trim(),
          contextText: i.contextText.trim(),
          extraContextFile: i.extraContextFile,
        }))
        .filter(i => !!i.url);
      if (cleaned.length === 0) return;
      onSummarizeManyUrls(cleaned, model, options, queueTargetFolderId || DEFAULT_FOLDER_ID);
      return;
    }

    if (mode === 'transcript' && isMultiTranscript) {
      const cleaned = multiTranscripts
        .map(t => ({
          transcript: t.transcript.trim(),
          contextText: t.contextText.trim(),
          extraContextFile: t.extraContextFile,
        }))
        .filter(t => !!t.transcript);
      if (cleaned.length === 0) return;
      onSummarizeManyTranscripts(cleaned, model, options, queueTargetFolderId || DEFAULT_FOLDER_ID);
      return;
    }

    const value = mode === 'url' ? url : transcript;
    if (!value.trim()) return;
    onSummarize(value, mode, model, options);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
         alert("File too large (Max 10MB)");
         return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // remove data:application/pdf;base64, prefix
        const base64Data = result.split(',')[1];
        setExtraContextFile({
          data: base64Data,
          mimeType: file.type,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
    setExtraContextFile(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSubmit = !isLoading && (
    mode === 'url'
      ? (isMultiUrl ? multiUrls.some(u => !!u.url.trim()) : !!url.trim())
      : (isMultiTranscript ? multiTranscripts.some(t => !!t.transcript.trim()) : !!transcript.trim())
  );

  const isQueueMode = (mode === 'url' && isMultiUrl) || (mode === 'transcript' && isMultiTranscript);
  const showQueueFolderSelect = isQueueMode;

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden mb-8">
      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center py-4 text-sm font-medium transition-colors ${
            mode === 'url' 
              ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Youtube className="w-4 h-4 mr-2" />
          Public YouTube URL
        </button>
        <button
          onClick={() => setMode('transcript')}
          className={`flex-1 flex items-center justify-center py-4 text-sm font-medium transition-colors ${
            mode === 'transcript' 
              ? 'bg-slate-800 text-yellow-400 border-b-2 border-yellow-500' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4 mr-2" />
          Unlisted / Manual Transcript
        </button>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-6 space-y-4">
          {/* Main Input */}
          {mode === 'url' ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={isMultiUrl}
                  onChange={(e) => setIsMultiUrl(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500/50"
                  disabled={isLoading}
                />
                Add multiple videos (queue)
              </label>

              {!isMultiUrl ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 pl-11 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    disabled={isLoading}
                  />
                  <Youtube className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  {multiUrls.map((item, idx) => {
                    const inputId = `multi-url-file-${idx}-${item.fileInputNonce}`;
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500">Video {idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => {
                              if (multiUrls.length <= 1) {
                                setMultiUrls([{ url: '', contextText: '', extraContextFile: undefined, fileInputNonce: 0 }]);
                                return;
                              }
                              setMultiUrls(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-slate-500 hover:text-white"
                            disabled={isLoading}
                            aria-label="Remove video"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={item.url}
                            onChange={(e) => {
                              const next = e.target.value;
                              setMultiUrls(prev => prev.map((p, i) => i === idx ? { ...p, url: next } : p));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 pl-11 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            disabled={isLoading}
                          />
                          <Youtube className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                        </div>

                        <textarea
                          placeholder="Context for this summary (optional)"
                          value={item.contextText}
                          onChange={(e) => {
                            const next = e.target.value;
                            setMultiUrls(prev => prev.map((p, i) => i === idx ? { ...p, contextText: next } : p));
                          }}
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none text-sm"
                          disabled={isLoading}
                        />

                        <div className="space-y-1">
                          <div className="text-xs text-slate-400 font-medium ml-1">Attach PDF/Text Context (Optional)</div>
                          <input
                            id={inputId}
                            type="file"
                            accept=".pdf,.txt"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const parsed = await readAsExtraContextFile(file);
                                setMultiUrls(prev => prev.map((p, i) => i === idx ? { ...p, extraContextFile: parsed } : p));
                              } catch (err: any) {
                                alert(err?.message || 'Failed to read file');
                              }
                            }}
                            className="hidden"
                            disabled={isLoading}
                          />
                          <div className="flex items-center gap-3">
                            <label
                              htmlFor={inputId}
                              className={`flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg text-sm text-slate-300 transition-colors ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                              <FileUp size={16} />
                              Choose File
                            </label>
                            {item.extraContextFile && (
                              <div className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg text-sm border border-indigo-500/30">
                                <span className="truncate max-w-[150px]">{item.extraContextFile.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMultiUrls(prev => prev.map((p, i) => i === idx ? { ...p, extraContextFile: undefined, fileInputNonce: p.fileInputNonce + 1 } : p));
                                  }}
                                  className="hover:text-white"
                                  disabled={isLoading}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMultiUrls(prev => [...prev, { url: '', contextText: '', extraContextFile: undefined, fileInputNonce: 0 }])}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg text-sm text-slate-300 transition-colors"
                      disabled={isLoading}
                    >
                      <Plus className="w-4 h-4" />
                      Add video
                    </button>
                    <div className="text-xs text-slate-500">
                      Runs up to <span className="text-slate-300">2</span> Gemini requests at once.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={isMultiTranscript}
                  onChange={(e) => setIsMultiTranscript(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-yellow-600 focus:ring-yellow-500/50"
                  disabled={isLoading}
                />
                Add multiple transcripts (queue)
              </label>

              {!isMultiTranscript ? (
                <div className="relative">
                  <textarea
                    placeholder="Paste the video transcript here..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none font-mono text-sm"
                    disabled={isLoading}
                  />
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                     <Info size={12} />
                     <span>Tip: Open video description → Show transcript</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {multiTranscripts.map((t, idx) => {
                    const inputId = `multi-transcript-file-${idx}-${t.fileInputNonce}`;
                    return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">Transcript {idx + 1}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (multiTranscripts.length <= 1) {
                              setMultiTranscripts([{ transcript: '', contextText: '', extraContextFile: undefined, fileInputNonce: 0 }]);
                              return;
                            }
                            setMultiTranscripts(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-500 hover:text-white"
                          disabled={isLoading}
                          aria-label="Remove transcript"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <textarea
                        placeholder="Paste the transcript here..."
                        value={t.transcript}
                        onChange={(e) => {
                          const next = e.target.value;
                          setMultiTranscripts(prev => prev.map((p, i) => i === idx ? { ...p, transcript: next } : p));
                        }}
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none font-mono text-sm"
                        disabled={isLoading}
                      />

                      <textarea
                        placeholder="Context for this summary (optional)"
                        value={t.contextText}
                        onChange={(e) => {
                          const next = e.target.value;
                          setMultiTranscripts(prev => prev.map((p, i) => i === idx ? { ...p, contextText: next } : p));
                        }}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none text-sm"
                        disabled={isLoading}
                      />

                      <div className="space-y-1">
                        <div className="text-xs text-slate-400 font-medium ml-1">Attach PDF/Text Context (Optional)</div>
                        <input
                          id={inputId}
                          type="file"
                          accept=".pdf,.txt"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const parsed = await readAsExtraContextFile(file);
                              setMultiTranscripts(prev => prev.map((p, i) => i === idx ? { ...p, extraContextFile: parsed } : p));
                            } catch (err: any) {
                              alert(err?.message || 'Failed to read file');
                            }
                          }}
                          className="hidden"
                          disabled={isLoading}
                        />
                        <div className="flex items-center gap-3">
                          <label
                            htmlFor={inputId}
                            className={`flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg text-sm text-slate-300 transition-colors ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
                          >
                            <FileUp size={16} />
                            Choose File
                          </label>
                          {t.extraContextFile && (
                            <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-lg text-sm border border-yellow-500/30">
                              <span className="truncate max-w-[150px]">{t.extraContextFile.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setMultiTranscripts(prev => prev.map((p, i) => i === idx ? { ...p, extraContextFile: undefined, fileInputNonce: p.fileInputNonce + 1 } : p));
                                }}
                                className="hover:text-white"
                                disabled={isLoading}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMultiTranscripts(prev => [...prev, { transcript: '', contextText: '', extraContextFile: undefined, fileInputNonce: 0 }])}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg text-sm text-slate-300 transition-colors"
                      disabled={isLoading}
                    >
                      <Plus className="w-4 h-4" />
                      Add transcript
                    </button>
                    <div className="text-xs text-slate-500">
                      Runs up to <span className="text-slate-300">2</span> Gemini requests at once.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Queue Folder Target */}
          {showQueueFolderSelect && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium ml-1">Save queued summaries to folder</label>
              <select
                value={queueTargetFolderId || DEFAULT_FOLDER_ID}
                onChange={(e) => setQueueTargetFolderId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                disabled={isLoading}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Attach PDF/Text Context (Front) */}
          {!isQueueMode && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium ml-1">Attach PDF/Text Context (Optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg text-sm text-slate-300 transition-colors"
                  disabled={isLoading}
                >
                  <FileUp size={16} />
                  Choose File
                </button>
                {extraContextFile && (
                  <div className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg text-sm border border-indigo-500/30">
                    <span className="truncate max-w-[150px]">{extraContextFile.name}</span>
                    <button type="button" onClick={clearFile} className="hover:text-white" disabled={isLoading}>
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggle Options */}
          <div>
            <button 
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              <Settings2 size={16} />
              {showOptions ? "Hide Options" : "Show Advanced Options"}
            </button>
          </div>

          {/* Advanced Options Panel */}
          {showOptions && (
            <div className="space-y-4 p-4 bg-slate-800/30 rounded-xl border border-slate-800 animate-in fade-in slide-in-from-top-2">
                {/* Row 1: Model & Language */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium ml-1">AI Model</label>
                        <div className="relative">
                            <select 
                                value={model} 
                                onChange={(e) => setModel(e.target.value as GeminiModel)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none"
                            >
                                <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            </select>
                            <Cpu className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium ml-1">Output Language</label>
                        <select 
                            value={outputLanguage} 
                            onChange={(e) => setOutputLanguage(e.target.value as OutputLanguage)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="auto">Auto (Same as Video)</option>
                            <option value="en">English</option>
                            <option value="he">Hebrew</option>
                        </select>
                    </div>
                </div>

                {/* Row 2: Extra Context */}
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium ml-1">Extra Context (Optional)</label>
                    <textarea 
                        value={extraContextText}
                        onChange={(e) => setExtraContextText(e.target.value)}
                        placeholder="Add specific instructions or background info..."
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none placeholder-slate-600"
                        disabled={isQueueMode}
                    />
                    {isQueueMode && (
                      <div className="text-xs text-slate-500">
                        In queue mode, add context per item above.
                      </div>
                    )}
                </div>
            </div>
          )}

        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full flex items-center justify-center py-3 rounded-xl text-white font-medium transition-all ${
            !canSubmit
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : mode === 'url'
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                : 'bg-yellow-600 hover:bg-yellow-500 shadow-lg shadow-yellow-500/20'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2 fill-current" />
              {(mode === 'url' && isMultiUrl) || (mode === 'transcript' && isMultiTranscript)
                ? 'Queue Summaries'
                : 'Generate Detailed Summary'}
            </>
          )}
        </button>

        {!!queueStats && (queueStats.pending > 0 || queueStats.running > 0) && (
          <div className="mt-3 text-xs text-slate-500 text-center">
            Queue: <span className="text-slate-300">{queueStats.running}</span> running • <span className="text-slate-300">{queueStats.pending}</span> pending
          </div>
        )}
      </form>
    </div>
  );
};