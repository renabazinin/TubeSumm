import React from 'react';
import { VideoSummary } from '../types';
import { Clock, BookOpen, Quote, Link as LinkIcon, Cpu } from 'lucide-react';

interface SummaryDisplayProps {
  data: VideoSummary;
}

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ data }) => {
  const isHebrew = data.language === 'he';
  
  return (
    <div 
      className={`w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
        isHebrew ? 'text-right' : 'text-left'
      }`}
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-xl relative">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 leading-tight">
          {data.title || "Untitled Summary"}
        </h1>

        {data.model && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded text-xs text-slate-400">
                <Cpu size={12} />
                <span>{data.model}</span>
            </div>
        )}
        
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3 text-indigo-400">
            <Quote className="w-5 h-5" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Overview</h3>
          </div>
          <p className="text-slate-300 leading-relaxed text-lg">
            {data.overview}
          </p>
        </div>

        {/* Sources / Grounding */}
        {data.sources && data.sources.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-3 text-slate-400">
                    <LinkIcon className="w-4 h-4" />
                    <h3 className="font-semibold text-xs uppercase tracking-wider">Sources</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {data.sources.map((source, idx) => (
                        <a 
                            key={idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-xs text-indigo-400 hover:text-indigo-300 border border-slate-700 transition-colors"
                        >
                            {source.title || new URL(source.url).hostname}
                        </a>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Chapters */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-400 px-2">
          <BookOpen className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Chapters Breakdown</h2>
        </div>

        <div className="grid gap-6">
          {data.chapters.map((chapter, index) => (
            <div 
              key={index} 
              className="group bg-slate-900 rounded-xl p-6 border border-slate-800 hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="flex flex-col md:flex-row gap-4 md:items-start">
                {/* Timestamp Badge */}
                <div className="flex-shrink-0">
                  <div className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium
                    ${chapter.timestamp 
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                      : 'bg-slate-800 text-slate-500 border border-slate-700'}
                  `}>
                    <Clock className="w-3 h-3" />
                    <span>{chapter.timestamp || "No Time"}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-grow space-y-3">
                  <h3 className="text-xl font-semibold text-slate-200 group-hover:text-white transition-colors">
                    {chapter.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {chapter.summary}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};