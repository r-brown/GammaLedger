import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
    const { getCurrentPrice } = await server.ssrLoadModule('/src/integrations/finnhub.ts')
    const stale = { price: 100, capturedAt: '2026-01-01T00:00:00.000Z', providerTimestamp: null }
    const calls = []
    const context = {
        schwab: { vault: {}, automaticRefresh: false, quoteCache: new Map([['TEST', stale]]) },
        finnhub: { apiKey: 'configured', cache: new Map(), outstandingRequests: new Map() },
        getSchwabUnderlyingQuote: async (symbol, forceRefresh) => {
            calls.push([symbol, forceRefresh])
            return { price: 125, capturedAt: '2026-08-15T00:00:00.000Z', providerTimestamp: null }
        },
        getCachedQuote: () => null,
        setCachedQuote: () => {},
        enqueueFinnhubRequest: async () => ({ price: 120, provider: 'Finnhub' }),
        updateFinnhubStatus: () => {}
    }

    const schwabQuote = await getCurrentPrice.call(context, 'test', { forceRefresh: true })
    assert.equal(schwabQuote.price, 125)
    assert.equal(schwabQuote.provider, 'Schwab')
    assert.deepEqual(calls, [['TEST', true]])

    context.getSchwabUnderlyingQuote = async () => { throw new Error('Schwab unavailable') }
    const fallbackQuote = await getCurrentPrice.call(context, 'test', { forceRefresh: true })
    assert.equal(fallbackQuote.price, 120)
    assert.equal(fallbackQuote.provider, 'Finnhub')

    console.log('Quote provider priority checks passed.')
} finally {
    await server.close()
}
