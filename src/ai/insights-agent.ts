// src/ai/insights-agent.ts
// AIInsightsAgent — AI Coach backed by the active LLMProvider, with LocalInsightsAgent as fallback.
import { DEFAULT_GEMINI_TEMPERATURE, DEFAULT_AI_MAX_TOKENS } from '../core/config.js';
import { LocalInsightsAgent } from './local-agent.js';
import { buildCoachMessages, type CoachPromptType } from './coach-prompts.js';
import {
    DRAFT_LEG_EXTRACTION_SCHEMA,
    DRAFT_LEG_SCHEMA_NAME,
    buildDraftLegExtractionPrompt,
    parseDraftLegExtraction,
    type DraftLegExtraction
} from './draft-leg-extraction.js';
import {
    LLMError,
    describeLLMError,
    type LLMDeltaHandler,
    type LLMProvider,
    type LLMProviderId,
    type LLMRequest,
    type LLMResponse,
    type LLMUsage
} from '../integrations/llm/types.js';

interface AIAppInterface {
    aiProvider?: { maxOutputTokens?: number }
    getActiveLLMProvider(): LLMProvider
    buildCoachContext(): string
    // Required by the LocalInsightsAgent fallback that shares this object.
    getCapitalAtRisk(trade: Record<string, unknown>): number
    formatCurrency(value: unknown, options?: Record<string, unknown>): string
    formatPercent?(value: unknown, fallback?: string, options?: Record<string, unknown>): string
    formatNumber?(value: unknown, options?: Record<string, unknown>): string | null
}

interface ChatMessage {
    sender?: string
    text?: string
    pending?: boolean
    [key: string]: unknown
}

export interface AIGenerateOptions {
    history?: ChatMessage[]
    promptType?: string | null
    onDelta?: LLMDeltaHandler
    signal?: AbortSignal
}

export interface AIReply {
    text: string
    usage: LLMUsage | null
    model: string | null
    provider: LLMProviderId | null
    /** The exact snapshot the request carried; the grounding check reads this, never a rebuilt one. */
    snapshotJson: string | null
    /** True when the user pressed Stop. */
    stopped?: boolean
}

interface DraftLegImageInput {
    mimeType: string
    data: string
    metadata?: Record<string, unknown>
}

const localReply = (text: string): AIReply => ({ text, usage: null, model: null, provider: null, snapshotJson: null });

export class AIInsightsAgent {
    app: AIAppInterface
    context: { stats: Record<string, unknown> | null; openTrades: Record<string, unknown>[] }
    fallback: LocalInsightsAgent

    constructor(app: AIAppInterface) {
        this.app = app;
        this.context = {
            stats: null,
            openTrades: []
        };
        this.fallback = new LocalInsightsAgent(app);
    }

    updateContext({ stats, openTrades }: { stats?: Record<string, unknown>; openTrades?: unknown[] } = {}): void {
        if (stats) {
            this.context.stats = stats;
        }
        if (Array.isArray(openTrades)) {
            this.context.openTrades = openTrades as Record<string, unknown>[];
        }
        this.fallback.updateContext({ stats: this.context.stats ?? undefined, openTrades: this.context.openTrades });
    }

    provider(): LLMProvider {
        return this.app.getActiveLLMProvider();
    }

    getGreeting(): string {
        const provider = this.provider();
        if (!provider.isConfigured()) {
            return `Connect your ${provider.displayName} API key in [Settings](#settings) to get tailored analysis.`;
        }
        return this.fallback.getGreeting();
    }

    isConfigured(): boolean {
        return this.provider().isConfigured();
    }

    maxOutputTokens(): number {
        return this.app.aiProvider?.maxOutputTokens || DEFAULT_AI_MAX_TOKENS;
    }

    async generateResponse(query = '', options: AIGenerateOptions = {}): Promise<AIReply> {
        const provider = this.provider();
        const prompt = query.trim();
        if (!prompt) {
            return localReply(`Ask a question and I'll send it to ${provider.displayName} along with a snapshot of your portfolio.`);
        }

        if (!provider.isConfigured()) {
            return localReply(`Add your ${provider.displayName} API key under [Settings](#settings) to enable AI-powered insights.`);
        }

        let streamed = '';
        try {
            await provider.prepare();
            const { request, snapshotJson } = this.buildChatRequestWithSnapshot(prompt, options);
            const onDelta = options.onDelta;
            const response: LLMResponse = onDelta
                ? await provider.stream(request, (text) => {
                    streamed = text;
                    onDelta(text);
                })
                : await provider.complete(request);
            if (response.text) {
                return { text: response.text, usage: response.usage, model: response.model, provider: response.provider, snapshotJson };
            }
            throw new LLMError('bad_response', 'empty reply');
        } catch (error) {
            // A user Stop is not a failure: keep what streamed, never fall back to the local snapshot.
            if (error instanceof LLMError && error.kind === 'aborted') {
                const partial = streamed.trim();
                return { text: partial ? `${partial}\n\n_(Stopped.)_` : 'Stopped.', usage: null, model: null, provider: provider.id, snapshotJson: null, stopped: true };
            }
            console.warn(`${provider.displayName} request failed:`, error);
            const reason = describeLLMError(error, provider.displayName);
            if (streamed.trim()) {
                return { text: `${streamed.trim()}\n\n_(Response interrupted: ${reason})_`, usage: null, model: null, provider: provider.id, snapshotJson: null };
            }
            const fallback = this.fallback.generateResponse(query);
            if (fallback) {
                return localReply(`${provider.displayName} request failed: ${reason} Here's a local snapshot instead:\n\n${fallback}`);
            }
            return localReply(`${provider.displayName} request failed: ${reason} Try again in a moment.`);
        }
    }

    async extractDraftLegsFromImage(input: DraftLegImageInput): Promise<DraftLegExtraction> {
        const provider = this.provider();
        if (!provider.isConfigured()) {
            throw new LLMError('missing_key', `Add your ${provider.displayName} API key under Settings before extracting screenshot trades.`);
        }

        if (!input?.mimeType || !input?.data) {
            throw new Error('Screenshot image data is missing.');
        }

        await provider.prepare();
        const capabilities = provider.capabilities(provider.activeModel());
        if (!capabilities.vision) {
            throw new LLMError('model_unavailable', "The selected model can't read images. Pick a vision model in Settings.");
        }

        const request = this.buildDraftLegExtractionRequest(input, capabilities.structuredOutput);
        let response: LLMResponse;
        try {
            response = await provider.complete(request);
        } catch (error) {
            if (!request.responseSchema || !(error instanceof LLMError) || error.kind !== 'model_unavailable') {
                throw error;
            }
            // Some routed endpoints reject json_schema; the lenient parser copes without it.
            response = await provider.complete({ ...request, responseSchema: undefined });
        }

        if (!response.text) {
            throw new LLMError('bad_response', 'empty extraction response');
        }
        return parseDraftLegExtraction(response.text);
    }

    buildDraftLegExtractionRequest(input: DraftLegImageInput, structuredOutput: boolean): LLMRequest {
        const metadata = input.metadata && typeof input.metadata === 'object'
            ? JSON.stringify(input.metadata, null, 2)
            : '{}';

        const request: LLMRequest = {
            messages: [{
                role: 'user',
                content: [
                    { type: 'image', mimeType: input.mimeType, base64: input.data },
                    { type: 'text', text: buildDraftLegExtractionPrompt(metadata) }
                ]
            }],
            maxOutputTokens: Math.min(this.maxOutputTokens(), DEFAULT_AI_MAX_TOKENS),
            temperature: 0.05
        };
        if (structuredOutput) {
            request.responseSchema = { name: DRAFT_LEG_SCHEMA_NAME, schema: DRAFT_LEG_EXTRACTION_SCHEMA };
        }
        return request;
    }

    buildChatRequestWithSnapshot(question: string, options: AIGenerateOptions = {}): { request: LLMRequest; snapshotJson: string } {
        const promptType: CoachPromptType = options.promptType === 'portfolio_health'
            || options.promptType === 'risk_check'
            || options.promptType === 'strategy_ideas'
            || options.promptType === 'watchlist_scan'
            ? options.promptType
            : 'chat';
        const snapshotJson = this.app.buildCoachContext();
        return {
            snapshotJson,
            request: {
                messages: buildCoachMessages({ snapshotJson, history: options.history || [], question, promptType }),
                maxOutputTokens: this.maxOutputTokens(),
                temperature: Number(DEFAULT_GEMINI_TEMPERATURE.toFixed(2)),
                signal: options.signal
            }
        };
    }

    buildChatRequest(question: string, options: AIGenerateOptions = {}): LLMRequest {
        return this.buildChatRequestWithSnapshot(question, options).request;
    }
}
