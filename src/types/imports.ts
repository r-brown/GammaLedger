import type { ISOTimestamp, DollarAmount } from './common'
import type { Trade } from './trade'

// ---------------------------------------------------------------------------
// §20 — Import payloads
// ---------------------------------------------------------------------------

/** One import error — row number, human reason, and raw record. */
export interface ImportError {
  /** 1-based row number in the source file. */
  row: number
  /** Human-readable explanation. */
  reason: string
  /** The unparsed / raw value that caused the error. */
  raw: unknown
}

/** Aggregate summary shown to the user after an import completes. */
export interface ImportSummary {
  totalRows: number
  importedCount: number
  duplicateCount: number
  errorCount: number
  /** Trades available for merge review (not yet confirmed). */
  mergeable: number
}

/** One entry in the import activity log. */
export interface ImportLogEntry {
  timestamp: ISOTimestamp
  level: 'info' | 'warning' | 'error'
  message: string
}

// ---------------------------------------------------------------------------
// Robinhood import
// ---------------------------------------------------------------------------

/**
 * Intermediate row as parsed from a Robinhood CSV file.
 * Fields are the raw CSV column values; normalization happens later.
 * Not all columns are listed; extend as needed during conversion.
 */
export interface RobinhoodTransaction {
  /** Raw CSV row number for error reporting. */
  rowIndex: number
  [key: string]: unknown
}

/**
 * Payload produced by buildRobinhoodImportPayload.
 */
export interface RobinhoodImportPayload {
  /** Proposed trades ready for merge/confirmation. */
  trades: Trade[]
  /** Raw intermediate transaction rows before group consolidation. */
  transactions: RobinhoodTransaction[]
  errors: ImportError[]
  summary: ImportSummary
}

// ---------------------------------------------------------------------------
// OFX import
// ---------------------------------------------------------------------------

/** Security record from the OFX SECLIST section. */
export interface OFXSecurity {
  uniqueid: string
  uniqueidtype: string
  secname: string
  ticker: string
  [key: string]: unknown
}

/** One transaction row as extracted from an OFX INVTRANLIST. */
export interface OFXTransaction {
  fitid: string
  dttrade: string
  memo?: string
  [key: string]: unknown
}

/**
 * Payload produced by buildOfxImportPayload.
 */
export interface OFXImportPayload {
  /** Proposed trades ready for merge/confirmation. */
  trades: Trade[]
  securities: OFXSecurity[]
  transactions: OFXTransaction[]
  errors: ImportError[]
  summary: ImportSummary
}

