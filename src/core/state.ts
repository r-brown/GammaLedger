// src/core/state.ts
// App state is managed entirely through the GammaLedger class instance (this.*).
// There is no standalone state singleton — this module re-exports the AppState
// type and provides a typed constant for the initial view name, used in
// the GammaLedger constructor.
//
// See src/types/state.ts for the full AppState interface documentation.

export type { AppState } from '@types-gl/state'

/** The view shown on first load. */
export const INITIAL_VIEW = 'dashboard' as const

export type InitialView = typeof INITIAL_VIEW

