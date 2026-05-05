// Pure crypto helpers — no class state required. Migrated from
// class GammaLedger (see docs/refactor/phase1-analysis.md §10).

export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export function getCrypto() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto) {
        return window.crypto;
    }
    return null;
}

export async function encryptString(plainText, cryptoApi, cryptoKey) {
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuffer = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(plainText));
    return {
        iv: arrayBufferToBase64(iv.buffer),
        ct: arrayBufferToBase64(cipherBuffer)
    };
}

export async function decryptString(payload, cryptoApi, cryptoKey) {
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
    const cipher = base64ToArrayBuffer(payload.ct);
    const plainBuffer = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, cipher);
    const dec = new TextDecoder();
    return dec.decode(plainBuffer);
}
