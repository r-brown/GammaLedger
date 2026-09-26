// src/utils/crypto.ts
// Pure crypto helpers — no class state required. Migrated from
// class GammaLedger during the TypeScript module split.

export interface EncryptedPayload {
    iv: string
    ct: string
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export function getCrypto(): Crypto | null {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto) {
        return window.crypto;
    }
    return null;
}

export async function encryptString(plainText: string, cryptoApi: Crypto, cryptoKey: CryptoKey): Promise<EncryptedPayload> {
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuffer = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(plainText));
    return {
        iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
        ct: arrayBufferToBase64(cipherBuffer)
    };
}

export async function decryptString(payload: EncryptedPayload, cryptoApi: Crypto, cryptoKey: CryptoKey): Promise<string> {
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
    const cipher = base64ToArrayBuffer(payload.ct);
    const plainBuffer = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, cipher);
    const dec = new TextDecoder();
    return dec.decode(plainBuffer);
}

export interface StringStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): unknown
}

/**
 * Loads the base64 AES-GCM key stored under `storageKey`, generating and
 * storing a fresh 256-bit key the first time.
 */
export async function loadOrCreateAesKey(storage: StringStorage, storageKey: string, cryptoApi: Crypto): Promise<CryptoKey> {
    let rawKeyB64 = storage.getItem(storageKey);
    if (!rawKeyB64) {
        const raw = cryptoApi.getRandomValues(new Uint8Array(32));
        rawKeyB64 = arrayBufferToBase64(raw.buffer as ArrayBuffer);
        storage.setItem(storageKey, rawKeyB64);
    }
    const rawKey = new Uint8Array(base64ToArrayBuffer(rawKeyB64));
    return cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
