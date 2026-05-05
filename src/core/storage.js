// Safe localStorage wrappers that gracefully handle quota and private-mode errors.
// Migrated from class GammaLedger (see docs/refactor/phase1-analysis.md §3).
// Higher-level persistence (saveToStorage / loadFromStorage) remains in
// legacy/app.js for now and will move to database/persist.js in Wave 11.

export const safeLocalStorage = {
    getItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.warn(`Failed to read from localStorage (key: ${key}):`, error);
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.warn(`Failed to write to localStorage (key: ${key}):`, error);
            // Handle quota exceeded or privacy mode
            if (error.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please clear some data or use a different browser.');
            } else if (error.name === 'SecurityError') {
                console.warn('localStorage is disabled in this browser (private mode?)');
            }
            return false;
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Failed to remove from localStorage (key: ${key}):`, error);
            return false;
        }
    }
};
