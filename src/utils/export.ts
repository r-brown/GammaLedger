// src/utils/export.ts
// Originally planned as the home for exportToCSV / saveWithDownload / saveWithFileSystemAPI.
// During Phase 1 migration these functions were placed in src/database/persist.js, which
// already owns the full persistence layer. This shim re-exports them so any future
// callers that import from @utils/export get the correct implementations.

export {
    exportToCSV,
    saveWithDownload,
    loadWithFileInput,
    buildDatabasePayload,
    saveToStorage
} from '../database/persist.js';

