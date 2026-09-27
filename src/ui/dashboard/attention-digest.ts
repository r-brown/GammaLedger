// src/ui/dashboard/attention-digest.ts — "Needs a look" dashboard card (roadmap 02).
// Deterministic items always render; the urgency label appears only when JEV ordered them.
// Uses the .call(this, …) delegation pattern.

import type { AttentionItem } from '../../types/ai.js'

interface AttentionDigestContext {
  getAttentionDigest?(): AttentionItem[]
  requestAttentionOrder?(): Promise<boolean>
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
}

const URGENCY_TEXT = ['Fine for now', 'Watch this week', 'Act before expiry']
const SEVERITY_CLASS: Record<AttentionItem['severity'], string> = { 3: 'act', 2: 'look', 1: 'glance' }

export function renderAttentionDigest(this: AttentionDigestContext, requestOrder = true): void {
  const root = document.getElementById('attention-digest')
  if (!root || !this.getAttentionDigest) return
  const items = this.getAttentionDigest()
  root.hidden = items.length === 0
  root.textContent = ''
  if (!items.length) return

  const heading = document.createElement('h3')
  heading.className = 'attention-digest__title'
  heading.textContent = `Needs a look (${items.length})`
  root.appendChild(heading)

  const list = document.createElement('ul')
  list.className = 'attention-digest__list'
  for (const item of items) {
    const li = document.createElement('li')
    li.className = `attention-digest__item attention-digest__item--${SEVERITY_CLASS[item.severity]}`
    const dot = document.createElement('span')
    dot.className = 'attention-digest__dot'
    dot.setAttribute('aria-hidden', 'true')
    li.appendChild(dot)
    li.appendChild(this.createTickerElement(item.ticker, 'ticker-link attention-digest__ticker'))
    const label = document.createElement('span')
    label.className = 'attention-digest__label'
    label.textContent = item.label
    li.appendChild(label)
    for (const reason of item.reasons) {
      const chip = document.createElement('span')
      chip.className = `attention-digest__reason attention-digest__reason--${reason.kind}`
      chip.textContent = reason.text
      li.appendChild(chip)
    }
    if (item.urgency !== null && item.urgency >= 0) {
      const urgency = document.createElement('span')
      urgency.className = 'attention-digest__urgency'
      urgency.textContent = URGENCY_TEXT[Math.min(2, Math.round(item.urgency))] ?? ''
      urgency.title = `Ordered by JEV (urgency ${item.urgency} on a 0–2 scale)`
      li.appendChild(urgency)
    }
    list.appendChild(li)
  }
  root.appendChild(list)

  if (requestOrder && this.requestAttentionOrder) {
    void this.requestAttentionOrder().then((changed) => {
      if (changed) renderAttentionDigest.call(this, false)
    })
  }
}
