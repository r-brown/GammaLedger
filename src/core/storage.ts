// Safe localStorage wrappers that gracefully handle quota and private-mode errors.
// Migrated from class GammaLedger during the TypeScript module split.

export interface SafeLocalStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): boolean
    removeItem(key: string): boolean
}

export const safeLocalStorage: SafeLocalStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.warn(`Failed to read from localStorage (key: ${key}):`, error);
            return null;
        }
    },
    setItem: (key: string, value: string): boolean => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.warn(`Failed to write to localStorage (key: ${key}):`, error);
            if ((error as DOMException).name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please clear some data or use a different browser.');
            } else if ((error as DOMException).name === 'SecurityError') {
                console.warn('localStorage is disabled in this browser (private mode?)');
            }
            return false;
        }
    },
    removeItem: (key: string): boolean => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Failed to remove from localStorage (key: ${key}):`, error);
            return false;
        }
    }
};
