// src/ai/chat.js — Wave 10: AI chat UI panel.
// Uses the .call(this, …) delegation pattern.

export function setupAIChatResizeHandle() {
    const panel = document.getElementById('ai-chat-panel');
    const handle = document.getElementById('ai-chat-resize-handle') || panel?.querySelector('.ai-chat__resize-handle');

    if (!panel || !handle || handle.dataset.initialized === 'true') {
        if (handle) {
            handle.dataset.initialized = 'true';
        }
        return;
    }

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

    const stopResizing = (event) => {
        if (!state.resizing) {
            return;
        }

        state.resizing = false;
        panel.classList.remove('ai-chat__panel--resizing');

        if (event) {
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch (error) {
                // Pointer may already be released; ignore.
            }
        }

        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', stopResizing);
        document.removeEventListener('pointercancel', stopResizing);
    };

    const onPointerMove = (moveEvent) => {
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

    handle.addEventListener('pointerdown', (event) => {
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
        } catch (error) {
            // Not all pointers support capture; ignore.
        }

        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', stopResizing);
        document.addEventListener('pointercancel', stopResizing);
    });

    handle.dataset.initialized = 'true';
}

export function initializeAIChat() {
    this.updateAIChatHeader();
    if (!this.aiAgent) {
        this.aiChatMessages = [];
        return;
    }

    const snapshot = this.calculateAdvancedStats();
    this.aiAgent.updateContext({
        stats: snapshot,
        openTrades: snapshot.openTradesList
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

export function toggleAIChat(forceOpen = null) {
    const panel = document.getElementById('ai-chat-panel');
    const toggle = document.getElementById('ai-chat-toggle');
    const input = document.getElementById('ai-chat-input');
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

export function appendAIChatMessage(sender, text, options = {}) {
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
                sender: normalizedSender,
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

    const entry = {
        id: id || `${this.aiChatSessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sender: normalizedSender,
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

export function renderAIChatMessages() {
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

export function updateAIChatHeader() {
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
        // Use DOM methods instead of innerHTML for better security
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
