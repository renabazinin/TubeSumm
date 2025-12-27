import React from 'react';
import { History, Trash2, FileText, Youtube } from 'lucide-react';
import { VideoSummary } from '../types';

interface HistorySidebarProps {
  summaries: VideoSummary[];
  onSelect: (summary: VideoSummary) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  activeId?: string;
  toggleSidebar: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  summaries, 
  onSelect, 
  onDelete, 
  isOpen,
  activeId,
  toggleSidebar
}) => {
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
        className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out z-30 lg:translate-x-0 ${
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

        <div className="overflow-y-auto h-[calc(100%-65px)] p-2 space-y-2">
          {summaries.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              <p>No history yet.</p>
              <p className="text-sm mt-2">Summarize a video to start!</p>
            </div>
          ) : (
            summaries.map((item) => (
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
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <h3 className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">
                  {item.title || "Untitled Summary"}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                  {item.language === 'he' ? 'Hebrew' : 'English'} • {item.chapters.length} Chapters
                </p>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};
