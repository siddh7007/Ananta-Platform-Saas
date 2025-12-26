/**
 * Saved Searches Store
 * CBP-P2-003: Saved Searches & Search History
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type SearchFilters } from '@/hooks/useComponentSearch';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: string;
  lastUsed: string;
  useCount: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters: SearchFilters;
  timestamp: string;
  resultCount: number;
}

interface SavedSearchesState {
  savedSearches: SavedSearch[];
  searchHistory: SearchHistoryItem[];
  maxHistoryItems: number;
  maxSavedSearches: number;
}

interface SavedSearchesActions {
  addSavedSearch: (name: string, query: string, filters: SearchFilters) => SavedSearch;
  removeSavedSearch: (id: string) => void;
  updateSavedSearch: (id: string, updates: Partial<SavedSearch>) => void;
  renameSavedSearch: (id: string, newName: string) => void;
  useSavedSearch: (id: string) => SavedSearch | undefined;
  addToHistory: (query: string, filters: SearchFilters, resultCount: number) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  getSavedSearch: (id: string) => SavedSearch | undefined;
  exportSavedSearches: () => string;
  importSavedSearches: (json: string) => boolean;
}

const MAX_HISTORY_ITEMS = 50;
const MAX_SAVED_SEARCHES = 100;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useSavedSearchesStore = create<SavedSearchesState & SavedSearchesActions>()(
  persist(
    (set, get) => ({
      savedSearches: [],
      searchHistory: [],
      maxHistoryItems: MAX_HISTORY_ITEMS,
      maxSavedSearches: MAX_SAVED_SEARCHES,

      addSavedSearch: (name, query, filters) => {
        const newSearch: SavedSearch = {
          id: generateId(),
          name: name.trim(),
          query,
          filters,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          useCount: 0,
        };

        set((state) => {
          // Limit saved searches
          const existing = state.savedSearches;
          if (existing.length >= MAX_SAVED_SEARCHES) {
            // Remove oldest by lastUsed date
            const sorted = [...existing].sort(
              (a, b) => new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime()
            );
            sorted.shift();
            return { savedSearches: [...sorted, newSearch] };
          }
          return { savedSearches: [...existing, newSearch] };
        });

        return newSearch;
      },

      removeSavedSearch: (id) => {
        set((state) => ({
          savedSearches: state.savedSearches.filter((s) => s.id !== id),
        }));
      },

      updateSavedSearch: (id, updates) => {
        set((state) => ({
          savedSearches: state.savedSearches.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      renameSavedSearch: (id, newName) => {
        set((state) => ({
          savedSearches: state.savedSearches.map((s) =>
            s.id === id ? { ...s, name: newName.trim() } : s
          ),
        }));
      },

      useSavedSearch: (id) => {
        const search = get().savedSearches.find((s) => s.id === id);
        if (search) {
          set((state) => ({
            savedSearches: state.savedSearches.map((s) =>
              s.id === id
                ? {
                    ...s,
                    lastUsed: new Date().toISOString(),
                    useCount: s.useCount + 1,
                  }
                : s
            ),
          }));
        }
        return search;
      },

      addToHistory: (query, filters, resultCount) => {
        // Skip if empty search
        if (!query && Object.keys(filters).length === 0) {
          return;
        }

        const historyItem: SearchHistoryItem = {
          id: generateId(),
          query,
          filters,
          timestamp: new Date().toISOString(),
          resultCount,
        };

        set((state) => {
          // Check for duplicate (same query and filters)
          const isDuplicate = state.searchHistory.some(
            (h) =>
              h.query === query &&
              JSON.stringify(h.filters) === JSON.stringify(filters)
          );

          if (isDuplicate) {
            // Move existing to top
            const existing = state.searchHistory.filter(
              (h) =>
                !(
                  h.query === query &&
                  JSON.stringify(h.filters) === JSON.stringify(filters)
                )
            );
            return {
              searchHistory: [historyItem, ...existing].slice(0, MAX_HISTORY_ITEMS),
            };
          }

          return {
            searchHistory: [historyItem, ...state.searchHistory].slice(
              0,
              MAX_HISTORY_ITEMS
            ),
          };
        });
      },

      removeFromHistory: (id) => {
        set((state) => ({
          searchHistory: state.searchHistory.filter((h) => h.id !== id),
        }));
      },

      clearHistory: () => {
        set({ searchHistory: [] });
      },

      getSavedSearch: (id) => {
        return get().savedSearches.find((s) => s.id === id);
      },

      exportSavedSearches: () => {
        const state = get();
        return JSON.stringify({
          savedSearches: state.savedSearches,
          exportedAt: new Date().toISOString(),
        });
      },

      importSavedSearches: (json) => {
        try {
          const data = JSON.parse(json);
          if (!Array.isArray(data.savedSearches)) {
            return false;
          }

          set((state) => {
            // Merge imported searches, avoiding duplicates by name
            const existingNames = new Set(state.savedSearches.map((s) => s.name));
            const newSearches = data.savedSearches.filter(
              (s: SavedSearch) => !existingNames.has(s.name)
            );

            return {
              savedSearches: [...state.savedSearches, ...newSearches].slice(
                0,
                MAX_SAVED_SEARCHES
              ),
            };
          });

          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'cbp-saved-searches',
      version: 1,
      storage: createJSONStorage(() => {
        // Safe localStorage access
        try {
          return localStorage;
        } catch {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
      }),
    }
  )
);

export default useSavedSearchesStore;
