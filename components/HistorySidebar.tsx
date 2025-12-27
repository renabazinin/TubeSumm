import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FolderPlus, History, Trash2, FileText, Youtube } from 'lucide-react';
import { VideoSummary } from '../types';
import { DEFAULT_FOLDER_ID, HistoryFolder } from '../utils/storage';

interface HistorySidebarProps {
  summaries: VideoSummary[];
  allSummaries?: VideoSummary[];
  folders: HistoryFolder[];
  activeFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveSummaryToFolder: (summaryId: string, folderId: string) => void;
  onReorderSummary: (folderId: string, summaryId: string, direction: 'up' | 'down') => void;
  onSelect: (summary: VideoSummary) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  activeId?: string;
  toggleSidebar: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  summaries, 
  allSummaries,
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onMoveSummaryToFolder,
  onReorderSummary,
  onSelect, 
  onDelete, 
  isOpen,
  activeId,
  toggleSidebar
}) => {
  const [newFolderName, setNewFolderName] = useState('');

  const countsByFolder = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of (allSummaries ?? summaries)) {
      const fid = s.folderId || DEFAULT_FOLDER_ID;
      map[fid] = (map[fid] || 0) + 1;
    }
    return map;
  }, [allSummaries, summaries]);

  const filteredSummaries = summaries;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside 
        className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-400">
            <History size={20} />
            <h2 className="font-semibold text-lg">History</h2>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Folder controls */}
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={activeFolderId}
              onChange={(e) => onSelectFolder(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({countsByFolder[f.id] || 0})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const name = newFolderName.trim();
                if (!name) return;
                onCreateFolder(name);
                setNewFolderName('');
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Create folder"
              title="Create folder"
            >
              <FolderPlus size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
            <button
              type="button"
              onClick={() => {
                if (activeFolderId === DEFAULT_FOLDER_ID) return;
                onDeleteFolder(activeFolderId);
                onSelectFolder(DEFAULT_FOLDER_ID);
              }}
              className={`p-2 rounded-lg transition-colors ${
                activeFolderId === DEFAULT_FOLDER_ID
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              aria-label="Delete folder"
              title={activeFolderId === DEFAULT_FOLDER_ID ? 'Cannot delete General' : 'Delete folder'}
              disabled={activeFolderId === DEFAULT_FOLDER_ID}
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Reorder with arrows • Move via folder selector
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100%-65px-132px)] p-2 space-y-2">
          {filteredSummaries.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              <p>No history yet.</p>
              <p className="text-sm mt-2">Summarize a video to start!</p>
            </div>
          ) : (
            filteredSummaries.map((item, idx) => (
              <div 
                key={item.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors border ${
                  activeId === item.id 
                    ? 'bg-slate-800 border-indigo-500/50' 
                    : 'bg-slate-900/50 border-transparent hover:bg-slate-800'
                }`}
                onClick={() => {
                  onSelect(item);
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 mb-1">
                    {item.sourceType === 'url' ? (
                      <Youtube size={14} className="text-red-400" />
                    ) : (
                      <FileText size={14} className="text-yellow-400" />
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderSummary(activeFolderId, item.id, 'up');
                      }}
                      className={`text-slate-600 hover:text-slate-200 transition-opacity ${idx === 0 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                      aria-label="Move up"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderSummary(activeFolderId, item.id, 'down');
                      }}
                      className={`text-slate-600 hover:text-slate-200 transition-opacity ${idx === filteredSummaries.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                      aria-label="Move down"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete summary"
                      title="Delete summary"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">
                  {item.title || "Untitled Summary"}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                  {item.language === 'he' ? 'Hebrew' : 'English'} • {item.chapters.length} Chapters
                </p>

                <div className="mt-2">
                  <select
                    value={item.folderId || DEFAULT_FOLDER_ID}
                    onChange={(e) => {
                      onMoveSummaryToFolder(item.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};
