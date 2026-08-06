// src/types/watchlist.ts — persisted watchlist entry (part of StorageSchema).

/** A ticker the user follows, with their own rating and notes. */
export interface WatchlistEntry {
  /** Normalized uppercase ticker symbol. */
  ticker: string
  /** Conviction rating 1–5 stars; null = unrated. */
  rating: number | null
  /** Free-text notes / thesis. */
  notes: string
  /** Target or alert price. */
  targetPrice?: number | null
  /** User-defined tags or folders. */
  tags?: string[]
  /** ISO date the ticker was added, e.g. "2026-08-06". */
  addedDate: string
}
