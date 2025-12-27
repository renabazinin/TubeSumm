import { VideoSummary } from "../types";

const STORAGE_KEY = 'tubesumm_history';
const API_KEY_STORAGE_KEY = 'tubesumm_gemini_api_key';
const API_KEY_REMEMBER_STORAGE_KEY = 'tubesumm_gemini_api_key_remember';

export const getRememberApiKey = (): boolean => {
  try {
    return localStorage.getItem(API_KEY_REMEMBER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setRememberApiKey = (remember: boolean) => {
  try {
    localStorage.setItem(API_KEY_REMEMBER_STORAGE_KEY, remember ? 'true' : 'false');
    if (!remember) {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Failed to persist remember api key flag", e);
  }
};

export const getApiKey = (): string => {
  try {
    if (!getRememberApiKey()) return '';
    return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setApiKey = (apiKey: string) => {
  try {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      return;
    }

    if (getRememberApiKey()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    }
  } catch (e) {
    console.error("Failed to persist api key", e);
  }
};

export const saveSummary = (summary: VideoSummary) => {
  try {
    const existing = getSummaries();
    const updated = [summary, ...existing].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save summary", e);
  }
};

export const getSummaries = (): VideoSummary[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load summaries", e);
    return [];
  }
};

export const deleteSummary = (id: string) => {
  try {
    const existing = getSummaries();
    const updated = existing.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to delete summary", e);
    return [];
  }
};
