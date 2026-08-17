import { z } from 'zod'
import { APP_CONFIG } from '@core/config'
import { SchwabQuoteCacheSchema, SchwabSettingsSchema, SchwabVaultEnvelopeSchema, SchwabVaultPayloadSchema } from '@core/schema'
import { safeLocalStorage, safeSessionStorage } from '@core/storage'
import type { NormalizedLeg } from '@types-gl/leg'
import type { SchwabOptionQuote, SchwabState, SchwabTradeQuote, SchwabVaultPayload } from '@types-gl/integrations'

const API_BASE = 'https://api.schwabapi.com'
const VAULT_ITERATIONS = 250_000
const AUTO_REFRESH_MS = 5 * 60 * 1000
const QUOTE_STALE_MS = 10 * 60 * 1000

const TokenSchema = z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().optional(),
    expires_in: z.number().positive(),
    refresh_token_expires_in: z.number().positive().optional()
}).passthrough()

const ContractSchema = z.object({
    symbol: z.string().min(1),
    putCall: z.string().optional(),
    strikePrice: z.number().optional(),
    expirationDate: z.union([z.string(), z.number()]).optional(),
    bid: z.number().nullable().optional(),
    ask: z.number().nullable().optional(),
    last: z.number().nullable().optional(),
    mark: z.number().nullable().optional(),
    multiplier: z.number().positive().optional(),
    quoteTimeInLong: z.number().optional(),
    tradeTimeInLong: z.number().optional()
}).passthrough()

type TradeRecord = Record<string, unknown>

export function getSchwabTradeQuoteKey(trade: TradeRecord): string {
    const legIds = (Array.isArray(trade.legs) ? trade.legs : [])
        .filter((leg): leg is TradeRecord => Boolean(leg) && typeof leg === 'object')
        .map(leg => String(leg.id || ''))
        .filter(Boolean)
        .sort()
        .join(',')
    return [trade.id, String(trade.ticker || '').trim().toUpperCase(), legIds].join('|')
}

interface SchwabContext {
    schwab: SchwabState
    trades: TradeRecord[]
    currentDate: Date
    safeLocalStorage: typeof safeLocalStorage
    summarizeLegs(legs: unknown[]): { activeOpenLegs: NormalizedLeg[] }
    summarizeLegRealization(trade: TradeRecord): { openCashFlow: number; openGroupKeys: Set<string> }
    buildLegLifecycleKey(leg: TradeRecord): string
    getLegOrderDescriptor(leg: Record<string, unknown>): { action: string; side: string }
    isActiveStatus(status: unknown): boolean
    hasAssignedInventory(trade: TradeRecord): boolean
    formatCurrency(value: unknown, opts?: Record<string, unknown>): string
    showNotification(message: string, type: string): void
    saveToStorage(): void
    markUnsavedChanges(): void
    updateActivePositionsTable(): void
    updateAssignedPositionsTable(): void
    updateCreditPlaybookView(): void
    currentView: string
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
    const binary = atob(value)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return copy.buffer
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', toArrayBuffer(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
        material,
        256
    )
    const raw = new Uint8Array(bits)
    return { key: await importAesKey(raw), raw }
}

async function encryptVault(payload: SchwabVaultPayload, key: CryptoKey, salt: Uint8Array, iterations: number): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify(payload))
    )
    return JSON.stringify({
        version: 1,
        iterations,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(encrypted))
    })
}

async function decryptVault(rawEnvelope: string, key: CryptoKey): Promise<SchwabVaultPayload> {
    const envelope = SchwabVaultEnvelopeSchema.parse(JSON.parse(rawEnvelope))
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(envelope.iv)) },
        key,
        toArrayBuffer(base64ToBytes(envelope.ciphertext))
    )
    return SchwabVaultPayloadSchema.parse(JSON.parse(new TextDecoder().decode(decrypted)))
}

function element<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null
}

function setStatus(this: SchwabContext, message: string, variant = 'neutral'): void {
    const status = this.schwab.elements.status
    if (!status) return
    status.textContent = message
    status.className = `schwab-status schwab-status--${variant}`
}

function updateControls(this: SchwabContext): void {
    const hasVault = Boolean(safeLocalStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_VAULT))
    const unlocked = Boolean(this.schwab.vault && this.schwab.encryptionKey)
    const connected = Boolean(this.schwab.vault?.refreshToken || this.schwab.vault?.accessToken)
    const setup = this.schwab.elements.setup
    const actions = this.schwab.elements.actions
    if (setup) setup.hidden = hasVault
    if (actions) actions.hidden = !hasVault
    const unlock = this.schwab.elements.unlock as HTMLButtonElement | undefined
    const authorize = this.schwab.elements.authorize as HTMLButtonElement | undefined
    const callback = this.schwab.elements.callback as HTMLButtonElement | undefined
    const refresh = this.schwab.elements.refresh as HTMLButtonElement | undefined
    const lock = this.schwab.elements.lock as HTMLButtonElement | undefined
    if (unlock) unlock.hidden = unlocked
    if (authorize) authorize.disabled = !unlocked
    if (callback) callback.disabled = !unlocked
    if (refresh) refresh.disabled = !connected || !unlocked
    if (lock) lock.disabled = !unlocked
    setStatus.call(this, !hasVault ? 'Not configured' : !unlocked ? 'Vault locked' : connected ? 'Connected and unlocked' : 'Configured — authorization required', connected ? 'success' : 'neutral')
}

function persistQuoteCache(this: SchwabContext): void {
    safeLocalStorage.setItem(APP_CONFIG.STORAGE.SCHWAB_QUOTE_CACHE, JSON.stringify({
        version: 1,
        underlying: Object.fromEntries(this.schwab.quoteCache),
        trades: Object.fromEntries(this.schwab.tradeQuoteCache)
    }))
}

function loadQuoteCache(this: SchwabContext): void {
    const raw = safeLocalStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_QUOTE_CACHE)
    if (!raw) return
    try {
        const parsed = SchwabQuoteCacheSchema.parse(JSON.parse(raw))
        this.schwab.quoteCache.clear()
        for (const [symbol, quote] of Object.entries(parsed.underlying)) {
            this.schwab.quoteCache.set(symbol, {
                price: quote.price,
                capturedAt: quote.capturedAt,
                providerTimestamp: quote.providerTimestamp ?? null
            })
        }
        this.schwab.tradeQuoteCache.clear()
        for (const [key, quote] of Object.entries(parsed.trades)) {
            this.schwab.tradeQuoteCache.set(key, {
                tradeId: quote.tradeId,
                ticker: quote.ticker,
                netMark: quote.netMark ?? null,
                liquidationMark: quote.liquidationMark ?? null,
                marketValue: quote.marketValue ?? null,
                openingCashFlow: quote.openingCashFlow,
                unrealizedPL: quote.unrealizedPL ?? null,
                capturedAt: quote.capturedAt,
                error: quote.error,
                legs: quote.legs.map(leg => ({
                    symbol: leg.symbol,
                    bid: leg.bid ?? null,
                    ask: leg.ask ?? null,
                    last: leg.last ?? null,
                    mark: leg.mark ?? null,
                    midpoint: leg.midpoint ?? null,
                    multiplier: leg.multiplier,
                    providerTimestamp: leg.providerTimestamp ?? null,
                    capturedAt: leg.capturedAt,
                    legId: leg.legId,
                    side: leg.side,
                    quantity: leg.quantity
                }))
            })
        }
    } catch (error) {
        console.warn('Ignoring invalid Schwab quote cache:', error)
    }
}

async function persistVault(this: SchwabContext): Promise<void> {
    if (!this.schwab.vault || !this.schwab.encryptionKey) throw new Error('Schwab vault is locked.')
    const current = SchwabVaultEnvelopeSchema.parse(JSON.parse(safeLocalStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_VAULT) || '{}'))
    const encrypted = await encryptVault(
        this.schwab.vault,
        this.schwab.encryptionKey,
        base64ToBytes(current.salt),
        current.iterations
    )
    if (!safeLocalStorage.setItem(APP_CONFIG.STORAGE.SCHWAB_VAULT, encrypted)) throw new Error('Could not store the Schwab vault.')
}

export async function loadSchwabConfigFromStorage(this: SchwabContext): Promise<void> {
    loadQuoteCache.call(this)
    const settingsRaw = safeLocalStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_SETTINGS)
    if (settingsRaw) {
        const parsed = SchwabSettingsSchema.safeParse(JSON.parse(settingsRaw))
        if (parsed.success) this.schwab.automaticRefresh = parsed.data.automaticRefresh
    }
    const envelope = safeLocalStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_VAULT)
    const sessionKey = safeSessionStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_SESSION_KEY)
    if (!envelope || !sessionKey) return
    try {
        const key = await importAesKey(base64ToBytes(sessionKey))
        this.schwab.vault = await decryptVault(envelope, key)
        this.schwab.encryptionKey = key
    } catch {
        safeSessionStorage.removeItem(APP_CONFIG.STORAGE.SCHWAB_SESSION_KEY)
    }
}

export function initializeSchwabControls(this: SchwabContext): void {
    this.schwab.elements = {
        setup: element('schwab-setup')!, actions: element('schwab-actions')!, status: element('schwab-status')!,
        unlock: element('schwab-unlock')!, authorize: element('schwab-authorize')!, callback: element('schwab-complete-auth')!,
        refresh: element('schwab-refresh')!, lock: element('schwab-lock')!
    }
    const automatic = element<HTMLInputElement>('schwab-auto-refresh')
    if (automatic) automatic.checked = this.schwab.automaticRefresh

    element('schwab-save-vault')?.addEventListener('click', () => { void configureVault.call(this) })
    element('schwab-unlock')?.addEventListener('click', () => { void unlockVault.call(this) })
    element('schwab-authorize')?.addEventListener('click', () => beginAuthorization.call(this))
    element('schwab-complete-auth')?.addEventListener('click', () => { void completeAuthorization.call(this) })
    element('schwab-refresh')?.addEventListener('click', () => { void refreshSchwabMarketData.call(this, { allowContractPrompt: true }) })
    element('schwab-lock')?.addEventListener('click', () => lockSchwab.call(this))
    element('schwab-reset')?.addEventListener('click', () => resetSchwab.call(this))
    automatic?.addEventListener('change', () => {
        this.schwab.automaticRefresh = automatic.checked
        safeLocalStorage.setItem(APP_CONFIG.STORAGE.SCHWAB_SETTINGS, JSON.stringify({ automaticRefresh: automatic.checked }))
        scheduleSchwabAutoRefresh.call(this)
    })
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.schwab.automaticRefresh && this.schwab.vault) void refreshSchwabMarketData.call(this)
    })
    updateControls.call(this)
    scheduleSchwabAutoRefresh.call(this)
}

async function configureVault(this: SchwabContext): Promise<void> {
    const clientId = element<HTMLInputElement>('schwab-client-id')?.value.trim() || ''
    const clientSecret = element<HTMLInputElement>('schwab-client-secret')?.value || ''
    const callbackUrl = element<HTMLInputElement>('schwab-callback-url')?.value.trim() || ''
    const passphrase = element<HTMLInputElement>('schwab-passphrase')?.value || ''
    const confirmation = element<HTMLInputElement>('schwab-passphrase-confirm')?.value || ''
    if (passphrase.length < 12) return setStatus.call(this, 'Use an encryption passphrase of at least 12 characters.', 'error')
    if (passphrase !== confirmation) return setStatus.call(this, 'The passphrases do not match.', 'error')
    const parsed = SchwabVaultPayloadSchema.safeParse({ clientId, clientSecret, callbackUrl })
    if (!parsed.success) return setStatus.call(this, 'Enter the client ID, client secret, and exact registered callback URL.', 'error')
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const derived = await deriveKey(passphrase, salt, VAULT_ITERATIONS)
        const encrypted = await encryptVault(parsed.data, derived.key, salt, VAULT_ITERATIONS)
        if (!safeLocalStorage.setItem(APP_CONFIG.STORAGE.SCHWAB_VAULT, encrypted)) throw new Error('Storage failed')
        safeSessionStorage.setItem(APP_CONFIG.STORAGE.SCHWAB_SESSION_KEY, bytesToBase64(derived.raw))
        this.schwab.vault = parsed.data
        this.schwab.encryptionKey = derived.key
        updateControls.call(this)
    } catch {
        setStatus.call(this, 'Could not create the encrypted Schwab vault.', 'error')
    }
}

async function unlockVault(this: SchwabContext): Promise<void> {
    const passphrase = element<HTMLInputElement>('schwab-unlock-passphrase')?.value || ''
    const raw = safeLocalStorage.getItem(APP_CONFIG.STORAGE.SCHWAB_VAULT)
    if (!raw || !passphrase) return setStatus.call(this, 'Enter your vault passphrase.', 'error')
    try {
        const envelope = SchwabVaultEnvelopeSchema.parse(JSON.parse(raw))
        const derived = await deriveKey(passphrase, base64ToBytes(envelope.salt), envelope.iterations)
        this.schwab.vault = await decryptVault(raw, derived.key)
        this.schwab.encryptionKey = derived.key
        safeSessionStorage.setItem(APP_CONFIG.STORAGE.SCHWAB_SESSION_KEY, bytesToBase64(derived.raw))
        updateControls.call(this)
        scheduleSchwabAutoRefresh.call(this)
    } catch {
        setStatus.call(this, 'Unable to unlock the vault. Check the passphrase.', 'error')
    }
}

function lockSchwab(this: SchwabContext): void {
    this.schwab.vault = null
    this.schwab.encryptionKey = null
    safeSessionStorage.removeItem(APP_CONFIG.STORAGE.SCHWAB_SESSION_KEY)
    if (this.schwab.timerId) clearInterval(this.schwab.timerId)
    this.schwab.timerId = null
    updateControls.call(this)
}

function resetSchwab(this: SchwabContext): void {
    if (!confirm('Reset the Schwab connection? Trade data will not be changed.')) return
    lockSchwab.call(this)
    safeLocalStorage.removeItem(APP_CONFIG.STORAGE.SCHWAB_VAULT)
    safeLocalStorage.removeItem(APP_CONFIG.STORAGE.SCHWAB_QUOTE_CACHE)
    this.schwab.quoteCache.clear()
    this.schwab.optionQuoteCache.clear()
    this.schwab.tradeQuoteCache.clear()
    updateControls.call(this)
}

function beginAuthorization(this: SchwabContext): void {
    const vault = this.schwab.vault
    if (!vault) return setStatus.call(this, 'Unlock the Schwab vault first.', 'error')
    const url = new URL(`${API_BASE}/v1/oauth/authorize`)
    url.searchParams.set('client_id', vault.clientId)
    url.searchParams.set('redirect_uri', vault.callbackUrl)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
    setStatus.call(this, 'Authorize in the new tab, then paste the full callback URL below.', 'neutral')
}

async function completeAuthorization(this: SchwabContext): Promise<void> {
    const vault = this.schwab.vault
    const pasted = element<HTMLInputElement>('schwab-callback-paste')?.value.trim() || ''
    if (!vault) return setStatus.call(this, 'Unlock the Schwab vault first.', 'error')
    try {
        const code = new URL(pasted).searchParams.get('code')
        if (!code) throw new Error('The callback URL does not contain an authorization code.')
        const token = await requestToken(vault, { grant_type: 'authorization_code', code, redirect_uri: vault.callbackUrl })
        applyToken(vault, token)
        await persistVault.call(this)
        updateControls.call(this)
        setStatus.call(this, 'Schwab authorization completed.', 'success')
    } catch (error) {
        setStatus.call(this, error instanceof Error ? error.message : 'Authorization failed.', 'error')
    }
}

async function requestToken(vault: SchwabVaultPayload, fields: Record<string, string>): Promise<z.infer<typeof TokenSchema>> {
    const response = await fetch(`${API_BASE}/v1/oauth/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${btoa(`${vault.clientId}:${vault.clientSecret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(fields)
    })
    const body: unknown = await response.json()
    if (!response.ok) throw new Error('Schwab rejected the token request. Verify the callback URL and credentials.')
    return TokenSchema.parse(body)
}

function applyToken(vault: SchwabVaultPayload, token: z.infer<typeof TokenSchema>): void {
    const now = Date.now()
    vault.accessToken = token.access_token
    if (token.refresh_token) vault.refreshToken = token.refresh_token
    vault.accessTokenExpiresAt = now + token.expires_in * 1000
    if (token.refresh_token_expires_in) vault.refreshTokenExpiresAt = now + token.refresh_token_expires_in * 1000
}

async function accessToken(this: SchwabContext): Promise<string> {
    const vault = this.schwab.vault
    if (!vault) throw new Error('Schwab vault is locked.')
    if (vault.accessToken && (vault.accessTokenExpiresAt || 0) > Date.now() + 60_000) return vault.accessToken
    if (!vault.refreshToken) throw new Error('Authorize Schwab in Settings first.')
    const token = await requestToken(vault, { grant_type: 'refresh_token', refresh_token: vault.refreshToken })
    applyToken(vault, token)
    await persistVault.call(this)
    return vault.accessToken || ''
}

async function marketDataRequest(this: SchwabContext, path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${API_BASE}${path}`)
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken.call(this)}` } })
    if (!response.ok) throw new Error(`Schwab market-data request failed (${response.status}).`)
    return response.json()
}

function recordValues(value: unknown): unknown[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    return Object.values(value)
}

function flattenContracts(value: unknown, output: z.infer<typeof ContractSchema>[] = []): z.infer<typeof ContractSchema>[] {
    if (Array.isArray(value)) {
        for (const item of value) {
            const parsed = ContractSchema.safeParse(item)
            if (parsed.success) output.push(parsed.data)
            else flattenContracts(item, output)
        }
        return output
    }
    for (const child of recordValues(value)) flattenContracts(child, output)
    return output
}

function contractExpiration(value: string | number | undefined): string {
    if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10)
    return String(value || '').slice(0, 10)
}

export function matchOptionContracts(
    contracts: z.infer<typeof ContractSchema>[],
    leg: Pick<NormalizedLeg, 'type' | 'strike' | 'expirationDate'>
): z.infer<typeof ContractSchema>[] {
    return contracts.filter(contract =>
        String(contract.putCall || '').toUpperCase() === leg.type
        && Math.abs(Number(contract.strikePrice) - Number(leg.strike)) < 0.0001
        && contractExpiration(contract.expirationDate) === leg.expirationDate
    )
}

function quoteFromContract(contract: z.infer<typeof ContractSchema>): SchwabOptionQuote {
    const bid = Number.isFinite(contract.bid) ? Number(contract.bid) : null
    const ask = Number.isFinite(contract.ask) ? Number(contract.ask) : null
    const last = Number.isFinite(contract.last) ? Number(contract.last) : null
    const midpoint = bid !== null && ask !== null ? (bid + ask) / 2 : null
    const mark = Number.isFinite(contract.mark) ? Number(contract.mark) : midpoint ?? last
    const timestamp = contract.quoteTimeInLong ?? contract.tradeTimeInLong
    return {
        symbol: contract.symbol, bid, ask, last, mark, midpoint,
        multiplier: contract.multiplier || 100,
        providerTimestamp: timestamp ? new Date(timestamp).toISOString() : null,
        capturedAt: new Date().toISOString()
    }
}

function quoteFromQuoteResponse(body: unknown, symbol: string): SchwabOptionQuote {
    const root = z.record(z.string(), z.unknown()).parse(body)
    const candidate = root[symbol] ?? Object.values(root)[0]
    const asset = z.object({
        symbol: z.string().optional(),
        quote: z.record(z.string(), z.unknown())
    }).passthrough().parse(candidate)
    const quote = asset.quote
    const numeric = (keys: string[]): number | null => {
        const value = keys.map(key => quote[key]).find(item => Number.isFinite(Number(item)))
        return Number.isFinite(Number(value)) ? Number(value) : null
    }
    const bid = numeric(['bidPrice', 'bid'])
    const ask = numeric(['askPrice', 'ask'])
    const last = numeric(['lastPrice', 'last'])
    const midpoint = bid !== null && ask !== null ? (bid + ask) / 2 : null
    const mark = numeric(['mark']) ?? midpoint ?? last
    const timestamp = numeric(['quoteTime', 'tradeTime'])
    return {
        symbol: asset.symbol || symbol,
        bid,
        ask,
        last,
        mark,
        midpoint,
        multiplier: numeric(['multiplier']) ?? 100,
        providerTimestamp: timestamp !== null ? new Date(timestamp).toISOString() : null,
        capturedAt: new Date().toISOString()
    }
}

async function resolveOptionQuote(
    this: SchwabContext,
    ticker: string,
    leg: NormalizedLeg,
    allowPrompt: boolean,
    forceRefresh = false
): Promise<SchwabOptionQuote> {
    if (leg.schwabSymbol) {
        const cached = this.schwab.optionQuoteCache.get(leg.schwabSymbol)
        if (cached && !forceRefresh) return cached
        const body = await marketDataRequest.call(this, '/marketdata/v1/quotes', {
            symbols: leg.schwabSymbol,
            fields: 'quote'
        })
        const quote = quoteFromQuoteResponse(body, leg.schwabSymbol)
        this.schwab.optionQuoteCache.set(quote.symbol, quote)
        return quote
    }
    const chain = await marketDataRequest.call(this, '/marketdata/v1/chains', {
        symbol: ticker,
        contractType: leg.type,
        strike: String(leg.strike),
        strategy: 'SINGLE',
        fromDate: leg.expirationDate,
        toDate: leg.expirationDate
    })
    const matches = matchOptionContracts(flattenContracts(chain), leg)
    if (matches.length === 0) throw new Error(`No Schwab contract matched ${ticker} ${leg.expirationDate} ${leg.strike} ${leg.type}.`)
    let selected = matches[0]
    if (matches.length > 1) {
        if (!allowPrompt) throw new Error(`Multiple Schwab contracts match ${ticker}; refresh manually to select one.`)
        const choice = prompt(`Choose the Schwab contract for ${ticker} ${leg.expirationDate} ${leg.strike} ${leg.type}:\n${matches.map((item, index) => `${index + 1}. ${item.symbol}`).join('\n')}`, '1')
        const index = Number(choice) - 1
        if (!Number.isInteger(index) || !matches[index]) throw new Error('Contract selection cancelled.')
        selected = matches[index]
    }
    const quote = quoteFromContract(selected)
    this.schwab.optionQuoteCache.set(selected.symbol, quote)
    return quote
}

export function calculateTradeQuote(
    tradeId: string,
    ticker: string,
    legs: Array<{ leg: NormalizedLeg; quote: SchwabOptionQuote; action: string }>,
    openingCashFlow = 0
): SchwabTradeQuote {
    const quantities = legs.map(({ leg }) => Math.abs(Number(leg.quantity) || 0)).filter(quantity => quantity > 0)
    const sameSide = legs.length > 1 && legs.every(({ action }) => action === legs[0]?.action)
    const packageQuantity = quantities.length === 0
        ? 1
        : sameSide
            ? quantities.reduce((sum, quantity) => sum + quantity, 0)
        : quantities.length === 1
            ? quantities[0]
            : quantities.reduce((base, quantity) => {
            if (!Number.isInteger(base) || !Number.isInteger(quantity)) return Math.min(base, quantity)
            let a = base
            let b = quantity
            while (b) [a, b] = [b, a % b]
            return a
            })
    let signedPackageMark = 0
    let liquidationMark = 0
    let marketValue = 0
    const quotedLegs = legs.map(({ leg, quote, action }) => {
        const side: 'short' | 'long' = action === 'SELL' ? 'short' : 'long'
        const direction = side === 'short' ? -1 : 1
        const quantity = Math.abs(Number(leg.quantity) || 0)
        const packageUnits = packageQuantity > 0 ? quantity / packageQuantity : 0
        if (quote.mark !== null) {
            signedPackageMark += direction * quote.mark * packageUnits
            marketValue += direction * quote.mark * quantity * quote.multiplier
        }
        const closePrice = side === 'short' ? quote.ask : quote.bid
        if (closePrice !== null) liquidationMark += -direction * closePrice * packageUnits
        return { ...quote, legId: leg.id, side, quantity }
    })
    const hasMarks = quotedLegs.length > 0 && quotedLegs.every(leg => leg.mark !== null)
    const hasLiquidationPrices = quotedLegs.length > 0 && quotedLegs.every(leg => leg.side === 'short' ? leg.ask !== null : leg.bid !== null)
    return {
        tradeId, ticker,
        netMark: hasMarks ? Math.abs(signedPackageMark) : null,
        liquidationMark: hasLiquidationPrices ? liquidationMark : null,
        marketValue: hasMarks ? marketValue : null,
        openingCashFlow,
        unrealizedPL: hasMarks ? openingCashFlow + marketValue : null,
        legs: quotedLegs,
        capturedAt: new Date().toISOString()
    }
}

async function refreshTradeQuote(this: SchwabContext, trade: TradeRecord, allowPrompt: boolean): Promise<void> {
    const ticker = String(trade.ticker || '').trim().toUpperCase()
    const tradeId = String(trade.id || '')
    const quoteKey = getSchwabTradeQuoteKey(trade)
    if (!ticker || !tradeId) return
    const summary = this.summarizeLegs(Array.isArray(trade.legs) ? trade.legs : [])
    const realization = this.summarizeLegRealization(trade)
    const activeLegs = summary.activeOpenLegs
        .filter(leg => (leg.type === 'CALL' || leg.type === 'PUT')
            && Number(leg.strike) > 0 && Boolean(leg.expirationDate)
            && realization.openGroupKeys.has(this.buildLegLifecycleKey(leg as unknown as TradeRecord)))
    if (!activeLegs.length) {
        this.schwab.tradeQuoteCache.delete(quoteKey)
        return
    }
    try {
        const legs = await Promise.all(activeLegs.map(async leg => ({
            leg,
            quote: await resolveOptionQuote.call(this, ticker, leg, allowPrompt, true),
            action: this.getLegOrderDescriptor(leg as unknown as Record<string, unknown>).action
        })))
        let symbolAdded = false
        const rawLegs = Array.isArray(trade.legs) ? trade.legs : []
        for (const item of legs) {
            const rawLeg = rawLegs.find(candidate => candidate && typeof candidate === 'object' && String(candidate.id || '') === item.leg.id)
            if (rawLeg && typeof rawLeg === 'object' && !rawLeg.schwabSymbol) {
                rawLeg.schwabSymbol = item.quote.symbol
                symbolAdded = true
            }
        }
        if (symbolAdded) {
            this.saveToStorage()
            this.markUnsavedChanges()
        }
        this.schwab.tradeQuoteCache.set(quoteKey, calculateTradeQuote(tradeId, ticker, legs, realization.openCashFlow))
    } catch (error) {
        if (this.schwab.tradeQuoteCache.has(quoteKey)) return
        this.schwab.tradeQuoteCache.set(quoteKey, {
            tradeId, ticker, netMark: null, liquidationMark: null, marketValue: null,
            openingCashFlow: realization.openCashFlow, unrealizedPL: null,
            legs: [], capturedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Quote unavailable.'
        })
    }
}

function parseUnderlyingQuote(body: unknown, symbol: string): { price: number; capturedAt: string; providerTimestamp: string | null } {
    const root = z.record(z.string(), z.unknown()).parse(body)
    const candidate = root[symbol] ?? Object.values(root)[0]
    const asset = z.object({ quote: z.record(z.string(), z.unknown()).optional() }).passthrough().parse(candidate)
    const quote = asset.quote || {}
    const priceKeys = ['mark', 'lastPrice', 'regularMarketLastPrice', 'closePrice']
    const price = priceKeys.map(key => quote[key]).find(value => Number.isFinite(Number(value)))
    if (!Number.isFinite(Number(price))) throw new Error(`Schwab returned no current price for ${symbol}.`)
    const timestampValue = quote.quoteTime ?? quote.tradeTime
    return {
        price: Number(price),
        capturedAt: new Date().toISOString(),
        providerTimestamp: Number.isFinite(Number(timestampValue)) ? new Date(Number(timestampValue)).toISOString() : null
    }
}

export async function getSchwabUnderlyingQuote(this: SchwabContext, ticker: string, forceRefresh = false, persist = true): Promise<{ price: number; capturedAt: string; providerTimestamp: string | null }> {
    const symbol = ticker.trim().toUpperCase()
    const cached = this.schwab.quoteCache.get(symbol)
    if (!forceRefresh && cached) return cached
    const body = await marketDataRequest.call(this, '/marketdata/v1/quotes', { symbols: symbol, fields: 'quote' })
    const quote = parseUnderlyingQuote(body, symbol)
    this.schwab.quoteCache.set(symbol, quote)
    if (persist) persistQuoteCache.call(this)
    return quote
}

export async function refreshSchwabMarketData(this: SchwabContext, options: { allowContractPrompt?: boolean } = {}): Promise<void> {
    if (this.schwab.refreshPromise) return this.schwab.refreshPromise
    if (!this.schwab.vault) {
        setStatus.call(this, 'Unlock and authorize Schwab first.', 'error')
        return
    }
    this.schwab.refreshPromise = (async () => {
        setStatus.call(this, 'Refreshing current Schwab prices…', 'neutral')
        const active = this.trades.filter(trade => this.isActiveStatus(trade.status) || this.hasAssignedInventory(trade))
        const tickers = [...new Set(active.map(trade => String(trade.ticker || '').trim().toUpperCase()).filter(Boolean))]
        const activeTickers = new Set(tickers)
        const activeTradeKeys = new Set(active.map(trade => getSchwabTradeQuoteKey(trade)))
        for (const ticker of this.schwab.quoteCache.keys()) {
            if (!activeTickers.has(ticker)) this.schwab.quoteCache.delete(ticker)
        }
        for (const key of this.schwab.tradeQuoteCache.keys()) {
            if (!activeTradeKeys.has(key)) this.schwab.tradeQuoteCache.delete(key)
        }
        await Promise.allSettled(tickers.map(ticker => getSchwabUnderlyingQuote.call(this, ticker, true, false)))
        for (const trade of active) await refreshTradeQuote.call(this, trade, Boolean(options.allowContractPrompt))
        persistQuoteCache.call(this)
        setStatus.call(this, `Updated ${tickers.length} ticker${tickers.length === 1 ? '' : 's'} and current option positions.`, 'success')
        renderVisibleView.call(this)
    })().finally(() => { this.schwab.refreshPromise = null })
    return this.schwab.refreshPromise
}

export function isSchwabQuoteStale(capturedAt: string, now = Date.now()): boolean {
    const captured = Date.parse(capturedAt)
    return !Number.isFinite(captured) || now - captured > QUOTE_STALE_MS
}

export function getSchwabLastQuoteAt(this: SchwabContext): string | null {
    const timestamps = [
        ...Array.from(this.schwab.quoteCache.values(), quote => quote.capturedAt),
        ...Array.from(this.schwab.tradeQuoteCache.values(), quote => quote.capturedAt)
    ].map(Date.parse).filter(Number.isFinite)
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null
}

function isRegularMarketHours(): boolean {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date())
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
    if (value.weekday === 'Sat' || value.weekday === 'Sun') return false
    const minutes = Number(value.hour) * 60 + Number(value.minute)
    return minutes >= 570 && minutes < 960
}

export function scheduleSchwabAutoRefresh(this: SchwabContext): void {
    if (this.schwab.timerId) clearInterval(this.schwab.timerId)
    this.schwab.timerId = null
    if (!this.schwab.automaticRefresh || !this.schwab.vault) return
    this.schwab.timerId = setInterval(() => {
        if (!document.hidden && isRegularMarketHours()) void refreshSchwabMarketData.call(this)
    }, AUTO_REFRESH_MS)
    if (isRegularMarketHours()) void refreshSchwabMarketData.call(this)
}

function renderVisibleView(this: SchwabContext): void {
    if (this.currentView === 'dashboard') this.updateActivePositionsTable()
    else if (this.currentView === 'credit-playbook') this.updateCreditPlaybookView()
}

export function renderSchwabTradeQuoteCell(this: SchwabContext, cell: HTMLElement, trade: TradeRecord): HTMLElement {
    const tradeId = String(trade.id || '')
    if (!tradeId) { cell.textContent = '—'; return cell }
    const quote = this.schwab.tradeQuoteCache.get(getSchwabTradeQuoteKey(trade))
    if (!quote) {
        cell.textContent = this.schwab.vault ? 'Refresh' : '—'
        cell.title = this.schwab.vault ? 'Use Refresh current prices in Settings.' : 'Connect Schwab in Settings.'
        return cell
    }
    if (quote.error || quote.netMark === null) {
        cell.textContent = 'Unavailable'
        cell.title = quote.error || 'Current option quote unavailable.'
        return cell
    }
    cell.textContent = this.formatCurrency(quote.netMark)
    cell.dataset.quoteState = isSchwabQuoteStale(quote.capturedAt) ? 'stale' : 'fresh'
    if (cell.dataset.quoteState === 'stale') {
        const stale = document.createElement('span')
        stale.className = 'quote-age'
        stale.textContent = 'Stale'
        cell.appendChild(stale)
    }
    const liquidationLabel = quote.liquidationMark === null
        ? 'unavailable'
        : `${this.formatCurrency(Math.abs(quote.liquidationMark))} ${quote.liquidationMark >= 0 ? 'debit' : 'credit'}`
    cell.title = [
        `${quote.legs.length === 1 ? 'Option mark' : 'Net spread mark'}: ${this.formatCurrency(quote.netMark)} per strategy unit`,
        `Conservative close estimate: ${liquidationLabel}`,
        `Signed position market value: ${this.formatCurrency(quote.marketValue)}`,
        `Unrealized option P&L: ${quote.unrealizedPL === null ? '—' : this.formatCurrency(quote.unrealizedPL)}`,
        ...quote.legs.map(leg => `${leg.side} ${leg.symbol}: mark ${leg.mark ?? '—'} · bid ${leg.bid ?? '—'} · ask ${leg.ask ?? '—'} · last ${leg.last ?? '—'}`),
        `Captured ${new Date(quote.capturedAt).toLocaleString()}`
    ].join('\n')
    return cell
}

export function cleanupSchwab(this: SchwabContext): void {
    if (this.schwab.timerId) clearInterval(this.schwab.timerId)
    this.schwab.timerId = null
}
