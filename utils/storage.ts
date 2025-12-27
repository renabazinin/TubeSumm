import { VideoSummary } from "../types";

const STORAGE_KEY = 'tubesumm_history';
const FOLDERS_KEY = 'tubesumm_history_folders';
const FOLDER_ORDERS_KEY = 'tubesumm_history_folder_orders';
export const DEFAULT_FOLDER_ID = 'general';

export type HistoryFolder = {
  id: string;
  name: string;
  createdAt: number;
};

type FolderOrders = Record<string, string[]>;

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeSummary = (summary: VideoSummary): VideoSummary => {
  return {
    ...summary,
    folderId: summary.folderId || DEFAULT_FOLDER_ID,
  };
};

const loadFoldersRaw = (): HistoryFolder[] => {
  return safeJsonParse<HistoryFolder[]>(localStorage.getItem(FOLDERS_KEY), []);
};

const ensureDefaultFolder = (folders: HistoryFolder[]): HistoryFolder[] => {
  const hasGeneral = folders.some(f => f.id === DEFAULT_FOLDER_ID);
  if (hasGeneral) return folders;
  return [{ id: DEFAULT_FOLDER_ID, name: 'General', createdAt: 0 }, ...folders];
};

export const getFolders = (): HistoryFolder[] => {
  try {
    const folders = ensureDefaultFolder(loadFoldersRaw());
    // persist once if needed
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return folders;
  } catch (e) {
    console.error('Failed to load folders', e);
    return [{ id: DEFAULT_FOLDER_ID, name: 'General', createdAt: 0 }];
  }
};

export const createFolder = (name: string): HistoryFolder | null => {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const folders = getFolders();
    const exists = folders.some(f => f.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return null;

    const folder: HistoryFolder = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
    };

    const updated = [...folders, folder];
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(updated));
    return folder;
  } catch (e) {
    console.error('Failed to create folder', e);
    return null;
  }
};

const loadFolderOrders = (): FolderOrders => {
  return safeJsonParse<FolderOrders>(localStorage.getItem(FOLDER_ORDERS_KEY), {});
};

const saveFolderOrders = (orders: FolderOrders) => {
  localStorage.setItem(FOLDER_ORDERS_KEY, JSON.stringify(orders));
};

export const deleteFolder = (folderId: string) => {
  if (folderId === DEFAULT_FOLDER_ID) return;
  try {
    const folders = getFolders().filter(f => f.id !== folderId);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(ensureDefaultFolder(folders)));

    // move summaries back to general
    const summaries = getSummaries().map(s => {
      if ((s.folderId || DEFAULT_FOLDER_ID) === folderId) {
        return { ...s, folderId: DEFAULT_FOLDER_ID };
      }
      return s;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));

    // merge order back to general, then remove deleted folder order
    const orders = loadFolderOrders();
    const deletedOrder = orders[folderId] || [];
    const generalOrder = orders[DEFAULT_FOLDER_ID] || [];
    const mergedGeneral = [...deletedOrder.filter(id => !generalOrder.includes(id)), ...generalOrder];
    const { [folderId]: _, ...rest } = orders;
    rest[DEFAULT_FOLDER_ID] = mergedGeneral;
    saveFolderOrders(rest);
  } catch (e) {
    console.error('Failed to delete folder', e);
  }
};

export const moveSummaryToFolder = (summaryId: string, folderId: string) => {
  try {
    const folders = getFolders();
    const targetExists = folders.some(f => f.id === folderId);
    const targetId = targetExists ? folderId : DEFAULT_FOLDER_ID;

    const summaries = getSummaries();
    const current = summaries.find(s => s.id === summaryId);
    if (!current) return;
    const fromId = current.folderId || DEFAULT_FOLDER_ID;

    const updated = summaries.map(s => s.id === summaryId ? { ...s, folderId: targetId } : s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    const orders = loadFolderOrders();
    orders[fromId] = (orders[fromId] || []).filter(id => id !== summaryId);
    orders[targetId] = [summaryId, ...(orders[targetId] || []).filter(id => id !== summaryId)];
    saveFolderOrders(orders);
  } catch (e) {
    console.error('Failed to move summary', e);
  }
};

export const reorderSummaryInFolder = (folderId: string, summaryId: string, direction: 'up' | 'down') => {
  try {
    const orders = loadFolderOrders();
    const order = [...(orders[folderId] || [])];
    const idx = order.indexOf(summaryId);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= order.length) return;
    [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
    orders[folderId] = order;
    saveFolderOrders(orders);
  } catch (e) {
    console.error('Failed to reorder summary', e);
  }
};

export const getSummariesForFolder = (folderId: string): VideoSummary[] => {
  const summaries = getSummaries().filter(s => (s.folderId || DEFAULT_FOLDER_ID) === folderId);
  const orders = loadFolderOrders();
  const order = orders[folderId] || [];
  if (order.length === 0) {
    return summaries.sort((a, b) => b.createdAt - a.createdAt);
  }
  const byId = new Map(summaries.map(s => [s.id, s] as const));
  const ordered: VideoSummary[] = [];
  for (const id of order) {
    const s = byId.get(id);
    if (s) ordered.push(s);
  }
  // append any summaries not in the order array
  for (const s of summaries) {
    if (!order.includes(s.id)) ordered.push(s);
  }
  return ordered;
};
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
    const normalized = normalizeSummary(summary);
    const existing = getSummaries();
    const updated = [normalized, ...existing].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    const folderId = normalized.folderId || DEFAULT_FOLDER_ID;
    const orders = loadFolderOrders();
    orders[folderId] = [normalized.id, ...(orders[folderId] || []).filter(id => id !== normalized.id)];
    saveFolderOrders(orders);
  } catch (e) {
    console.error("Failed to save summary", e);
  }
};

export const getSummaries = (): VideoSummary[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeSummary);
    // write back normalization once
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
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

    const orders = loadFolderOrders();
    for (const key of Object.keys(orders)) {
      orders[key] = (orders[key] || []).filter(x => x !== id);
    }
    saveFolderOrders(orders);

    return updated;
  } catch (e) {
    console.error("Failed to delete summary", e);
    return [];
  }
};
