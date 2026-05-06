// src/ai/chat.ts — Wave 10: AI chat UI panel.
// Uses the .call(this, …) delegation pattern.

interface ChatMessage {
    id: string
    sender: 'ai' | 'user'
    text: string
    timestamp: Date
    pending: boolean
}

interface AIAgent {
    updateContext(ctx: Record<string, unknown>): void
    getGreeting(): string
    generateResponse(query: string, options?: Record<string, unknown>): Promise<string> | string
}

interface AIChatContext {
    aiAgent: AIAgent | null
    aiChatMessages: ChatMessage[]
    aiChatSessionId: number | null
    aiChatPendingRequest: boolean | Promise<unknown> | null
    aiChatOpen: boolean
    gemini?: { apiKey?: string | null } | null
    renderAIChatMessages(): void
    appendAIChatMessage(sender: string, text: string, options?: Record<string, unknown>): string | null
    calculateAdvancedStats(): Record<string, unknown>
    hasAICoachConsent(): boolean
    promptAICoachConsent(callback: () => void): void
    handleAIChatSubmit(): Promise<void>
    handleAIQuickPrompt(prompt: string, options?: { promptType?: string | null; [key: string]: unknown }): Promise<void>
    toggleAIChat(forceOpen?: boolean | null): void
    getGeminiChatDisplayName(): string
    renderMarkdownToHTML(text: string): string
    updateAIChatHeader(): void
    updateActivePositionsTable(): void
}

export function setupAIChatResizeHandle(): void {
    const panel = document.getElementById('ai-chat-panel');
    const handle = (document.getElementById('ai-chat-resize-handle') || panel?.querySelector('.ai-chat__resize-handle')) as HTMLElement | null;

    if (!panel || !handle || handle.dataset.initialized === 'true') {
        if (handle) {
            handle.dataset.initialized = 'true';
        }
        return;
    }

    const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

    const state = {
        resizing: false,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        maxWidth: 0,
        maxHeight: 0,
        minWidth: 280,
        minHeight: 280,
        rightMargin: 24,
        bottomMargin: 24,
        viewportPadding: 24
    };

    const stopResizing = (event?: PointerEvent): void => {
        if (!state.resizing) {
            return;
        }

        state.resizing = false;
        panel.classList.remove('ai-chat__panel--resizing');

        if (event) {
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch (_error) {
                // Pointer may already be released; ignore.
            }
        }

        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', stopResizing as EventListener);
        document.removeEventListener('pointercancel', stopResizing as EventListener);
    };

    const onPointerMove = (moveEvent: PointerEvent): void => {
        if (!state.resizing) {
            return;
        }

        moveEvent.preventDefault();

        const deltaX = moveEvent.clientX - state.startX;
        const deltaY = moveEvent.clientY - state.startY;

        const nextWidth = clamp(state.startWidth - deltaX, state.minWidth, state.maxWidth);
        const nextHeight = clamp(state.startHeight - deltaY, state.minHeight, state.maxHeight);

        panel.style.width = `${nextWidth}px`;
        panel.style.height = `${nextHeight}px`;
    };

    handle.addEventListener('pointerdown', (event: PointerEvent) => {
        if (event.button !== 0 && event.pointerType !== 'touch') {
            return;
        }

        event.preventDefault();

        const rect = panel.getBoundingClientRect();

        state.resizing = true;
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.startWidth = rect.width;
        state.startHeight = rect.height;
        state.rightMargin = Math.max(state.viewportPadding, Math.round(window.innerWidth - rect.right));
        state.bottomMargin = Math.max(state.viewportPadding, Math.round(window.innerHeight - rect.bottom));
        state.maxWidth = Math.max(state.minWidth, window.innerWidth - state.rightMargin - state.viewportPadding);
        state.maxHeight = Math.max(state.minHeight, window.innerHeight - state.bottomMargin - state.viewportPadding);

        panel.classList.add('ai-chat__panel--resizing');
        panel.style.removeProperty('transform');

        try {
            handle.setPointerCapture(event.pointerId);
        } catch (_error) {
            // Not all pointers support capture; ignore.
        }

        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', stopResizing as EventListener);
        document.addEventListener('pointercancel', stopResizing as EventListener);
    });

    handle.dataset.initialized = 'true';
}

export function initializeAIChat(this: AIChatContext): void {
    this.updateAIChatHeader();
    if (!this.aiAgent) {
        this.aiChatMessages = [];
        return;
    }

    const snapshot = this.calculateAdvancedStats();
    this.aiAgent.updateContext({
        stats: snapshot,
        openTrades: (snapshot as { openTradesList?: unknown[] }).openTradesList
    });

    this.aiChatSessionId = Date.now();
    this.aiChatMessages = [];
    this.aiChatPendingRequest = false;

    const greeting = this.aiAgent.getGreeting();
    if (greeting) {
        this.appendAIChatMessage('ai', greeting);
    } else {
        this.renderAIChatMessages();
    }
}

export function toggleAIChat(this: AIChatContext, forceOpen: boolean | null = null): void {
    const panel = document.getElementById('ai-chat-panel');
    const toggle = document.getElementById('ai-chat-toggle');
    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    if (!panel || !toggle) {
        return;
    }

    const shouldOpen = forceOpen === null ? panel.classList.contains('hidden') : Boolean(forceOpen);

    if (shouldOpen) {
        if (!this.hasAICoachConsent()) {
            this.promptAICoachConsent(() => this.toggleAIChat(true));
            return;
        }
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        this.aiChatOpen = true;
        if (input) {
            setTimeout(() => input.focus(), 80);
        }
    } else {
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        this.aiChatOpen = false;
    }
}

export async function handleAIChatSubmit(this: AIChatContext): Promise<void> {
    if (this.aiChatPendingRequest) {
        return;
    }

    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    if (!input) {
        return;
    }

    const query = input.value.trim();
    if (!query) {
        return;
    }

    if (!this.hasAICoachConsent()) {
        this.promptAICoachConsent(() => {
            if (!input.value.trim()) {
                input.value = query;
            }
            this.handleAIChatSubmit();
        });
        return;
    }

    this.appendAIChatMessage('user', query);
    input.value = '';

    const placeholderId = this.appendAIChatMessage('ai', 'Analyzing your portfolio...', { pending: true });
    const historySnapshot = this.aiChatMessages
        .filter(message => message.id !== placeholderId)
        .slice(-10)
        .map(message => ({ ...message }));

    this.aiChatPendingRequest = true;

    try {
        const response = this.aiAgent
            ? await this.aiAgent.generateResponse(query, { history: historySnapshot })
            : 'AI assistant is unavailable at the moment.';
        this.appendAIChatMessage('ai', response, { replaceId: placeholderId, pending: false });
    } catch (error) {
        const message = error?.message || 'Unknown error';
        const fallback = 'Sorry, I could not reach Gemini right now. Please try again soon.';
        this.appendAIChatMessage('ai', `${fallback} (${message})`, { replaceId: placeholderId, pending: false });
    } finally {
        this.aiChatPendingRequest = false;
        if (input) {
            input.focus();
        }
    }
}

export async function handleAIQuickPrompt(
    this: AIChatContext,
    prompt: string,
    options: { promptType?: string | null; [key: string]: unknown } = {}
): Promise<void> {
    if (this.aiChatPendingRequest || !prompt) {
        return;
    }

    if (!this.hasAICoachConsent()) {
        this.promptAICoachConsent(() => this.handleAIQuickPrompt(prompt, options));
        return;
    }

    this.toggleAIChat(true);

    const input = document.getElementById('ai-chat-input') as HTMLInputElement | null;
    if (input) {
        input.value = '';
    }

    this.appendAIChatMessage('user', prompt);

    const placeholderId = this.appendAIChatMessage('ai', 'Analyzing your portfolio...', { pending: true });
    const historySnapshot = this.aiChatMessages
        .filter(message => message.id !== placeholderId)
        .slice(-10)
        .map(message => ({ ...message }));

    this.aiChatPendingRequest = true;

    try {
        const response = this.aiAgent
            ? await this.aiAgent.generateResponse(prompt, { history: historySnapshot, promptType: options.promptType || null })
            : 'AI assistant is unavailable at the moment.';
        this.appendAIChatMessage('ai', response, { replaceId: placeholderId, pending: false });
    } catch (error) {
        const message = error?.message || 'Unknown error';
        const fallback = 'Sorry, I could not reach Gemini right now. Please try again soon.';
        this.appendAIChatMessage('ai', `${fallback} (${message})`, { replaceId: placeholderId, pending: false });
    } finally {
        this.aiChatPendingRequest = false;
        if (input) {
            input.focus();
        }
    }
}

export function appendAIChatMessage(
    this: AIChatContext,
    sender: string,
    text: string,
    options: { suppressRender?: boolean; replaceId?: string | null; id?: string | null; pending?: boolean } = {}
): string | null {
    const normalizedSender = sender === 'ai' ? 'ai' : 'user';
    const {
        suppressRender = false,
        replaceId = null,
        id = null,
        pending = false
    } = options || {};

    if (!replaceId && (typeof text !== 'string' || text.length === 0)) {
        return null;
    }

    const timestamp = new Date();

    if (replaceId) {
        const index = this.aiChatMessages.findIndex(message => message.id === replaceId);
        if (index !== -1) {
            const existing = this.aiChatMessages[index];
            this.aiChatMessages[index] = {
                ...existing,
                sender: normalizedSender as 'ai' | 'user',
                text: text || '',
                timestamp,
                pending: Boolean(pending)
            };

            if (!suppressRender) {
                this.renderAIChatMessages();
            }

            return this.aiChatMessages[index].id;
        }
    }

    const entry: ChatMessage = {
        id: id || `${this.aiChatSessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sender: normalizedSender as 'ai' | 'user',
        text: text || '',
        timestamp,
        pending: Boolean(pending)
    };

    this.aiChatMessages = [...this.aiChatMessages, entry].slice(-200);

    if (!suppressRender) {
        this.renderAIChatMessages();
    }

    return entry.id;
}

export function renderAIChatMessages(this: AIChatContext): void {
    const history = document.getElementById('ai-chat-history');
    if (!history) {
        return;
    }

    history.innerHTML = '';

    this.aiChatMessages.forEach(message => {
        const item = document.createElement('div');
        item.className = `ai-chat__message ai-chat__message--${message.sender}`;

        if (message.pending) {
            item.classList.add('ai-chat__message--pending');
        }

        const label = document.createElement('span');
        label.textContent = message.sender === 'ai'
            ? this.getGeminiChatDisplayName()
            : 'You';
        item.appendChild(label);

        const bubble = document.createElement('div');
        bubble.className = 'ai-chat__bubble';
        if (message.pending) {
            bubble.setAttribute('data-pending', 'true');
        }
        if (message.sender === 'ai') {
            bubble.innerHTML = this.renderMarkdownToHTML(message.text);
        } else {
            bubble.textContent = message.text;
        }
        item.appendChild(bubble);

        history.appendChild(item);
    });

    history.scrollTop = history.scrollHeight;
}

export function updateAIChatHeader(this: AIChatContext): void {
    const titleEl = document.getElementById('ai-chat-title');
    const subtitleEl = document.getElementById('ai-chat-subtitle');

    if (!titleEl && !subtitleEl) {
        return;
    }

    if (titleEl) {
        titleEl.textContent = 'Portfolio AI Coach';
    }

    if (!subtitleEl) {
        return;
    }

    const hasKey = Boolean(this.gemini?.apiKey);
    const hasConsent = this.hasAICoachConsent();

    if (!hasKey) {
        subtitleEl.textContent = '';
        const text1 = document.createTextNode('Connect your Gemini API key in ');
        const link = document.createElement('a');
        link.href = '#settings';
        link.className = 'ai-chat__settings-link';
        link.textContent = 'Settings';
        const text2 = document.createTextNode(' to get tailored analysis.');
        subtitleEl.appendChild(text1);
        subtitleEl.appendChild(link);
        subtitleEl.appendChild(text2);
    } else if (!hasConsent) {
        subtitleEl.textContent = 'Review and accept the AI Coach data-sharing notice to start asking questions.';
    } else {
        subtitleEl.textContent = 'Ask about your portfolio for AI-guided insights.';
    }
}
