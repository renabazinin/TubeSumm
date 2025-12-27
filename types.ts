export interface Chapter {
  title: string;
  timestamp?: string; // Optional as manual transcripts might not have them
  summary: string;
}

export interface VideoSummary {
  id: string; // Unique ID for storage
  title: string;
  language: 'en' | 'he';
  overview: string;
  chapters: Chapter[];
  createdAt: number;
  sourceType: 'url' | 'transcript';
  sourceValue: string; // The URL or a snippet of the transcript
  sources?: { title: string; url: string }[];
  model?: string;
  // New fields
  outputLanguage?: string;
  hasExtraContext?: boolean;
  folderId?: string; // defaults to 'general'
}

export interface StoredSummary extends VideoSummary {}

export type SummarizeMode = 'url' | 'transcript';
export type GeminiModel = 'gemini-3-flash-preview' | 'gemini-2.5-flash';
export type OutputLanguage = 'auto' | 'en' | 'he';

export interface ExtraContextFile {
  data: string; // base64 without prefix
  mimeType: string;
  name: string;
}

export interface SummaryOptions {
  outputLanguage: OutputLanguage;
  extraContextText?: string;
  extraContextFile?: ExtraContextFile;
}

// Gemini Schema helper types
export enum GeminiLanguage {
  EN = 'en',
  HE = 'he'
}