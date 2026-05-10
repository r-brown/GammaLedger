// src/ui/tables/active-positions.ts — Wave 9: Active positions grid rendering.
// Uses the .call(this, …) delegation pattern.

import {
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams
} from './ag-grid.js'

type TradeRecord = Record<string, unknown>

interface ActivePositionsContext {
  trades: TradeRecord[]
  activePositionsGridApi?: GridApi<TradeRecord> | null
  activeQuoteEntries: Map<string, Record<string, unknown>>
  isActiveStatus(status: unknown): boolean
  isWheelOrPmccTrade(trade: TradeRecord): boolean
  isAssignmentTrade(trade: TradeRecord): boolean
  hasNonExpiredOpenShortOptions(trade: TradeRecord): boolean
  lifecycleStatus?: string
  parseInteger(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  parseDecimal(value: unknown, fallback: unknown, opts?: { allowNegative?: boolean }): number | null
  createTickerElement(ticker: unknown, className?: string, opts?: Record<string, unknown>): HTMLElement
  openTradesFilteredByTicker(ticker: unknown): void
  summarizeLegs(legs: unknown[]): Record<string, unknown>
  getActiveStrikeForDisplay(summary: Record<string, unknown>): number | null
  formatNumber(value: unknown, opts: Record<string, unknown>): string | null
  formatCurrency(value: unknown, opts?: Record<string, unknown>): string
  getQuoteEntryKey(trade: TradeRecord): string
  populateQuoteCell(cell: HTMLElement | null, trade: TradeRecord, row: HTMLElement | null, opts: Record<string, unknown>): void
  updateExpirationHighlight(cell: HTMLElement, trade: TradeRecord): void
  rebuildQuoteRefreshSchedule(): void
  startQuoteAutoRefreshIfNeeded(): void
  refreshActivePositionsQuotes(opts: { force: boolean; immediate: boolean }): void
  earningsMap: Map<string, string>
  metricsCache: Map<string, import('../../types/integrations.js').StockMetrics | 'loading' | 'error'>
  getEarningsDateForTrade(trade: TradeRecord): string | null
  fetchStockMetrics(ticker: string): Promise<import('../../types/integrations.js').StockMetrics | null>
  positionFormulaTooltip(wrapper: HTMLElement, tooltip: HTMLElement): void
  finnhub: { apiKey: string | null; cache: Map<string, { c?: number }> }
  formatDate(value: unknown): string
}

function activeRowKey(trade: TradeRecord): string {
    return String(trade.id ?? `${trade.ticker || 'active'}-${trade.openedDate || ''}`)
        .replace(/[^a-zA-Z0-9_-]/g, '-');
}

function resolveActiveStrike(this: ActivePositionsContext, trade: TradeRecord): number | null {
    let resolvedStrike = this.parseDecimal(trade.activeStrikePrice, null, { allowNegative: false });

    if (resolvedStrike === null && Array.isArray(trade.legs) && (trade.legs as unknown[]).length > 0) {
        const strikeSummary = this.summarizeLegs(trade.legs as unknown[]);
        const summaryStrike = this.getActiveStrikeForDisplay(strikeSummary);
        if (Number.isFinite(summaryStrike)) {
            resolvedStrike = summaryStrike;
        }
    }

    if (resolvedStrike === null) {
        resolvedStrike = this.parseDecimal(trade.strikePrice, null, { allowNegative: false });
    }

    return Number.isFinite(resolvedStrike) ? resolvedStrike : null;
}

type MetricsCacheValue = import('../../types/integrations.js').StockMetrics | 'loading' | 'error';
type StockMetrics = import('../../types/integrations.js').StockMetrics;

function createMetricsTooltipEl(ticker: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'metrics-popup';
    el.setAttribute('aria-hidden', 'true');
    el.dataset.metricsFor = ticker;
    document.body.appendChild(el);
    return el;
}

function fmtPct(v: number | null, showSign = false): string {
    if (v === null) return '—';
    const sign = showSign && v > 0 ? '+' : '';
    return `${sign}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

function fmtCap(millions: number | null): string {
    if (millions === null) return '—';
    if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
    return `$${millions.toFixed(0)}M`;
}

function fmtDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function makeKV(label: string, value: string, modifier = ''): HTMLElement {
    const kv = document.createElement('div');
    kv.className = 'mp-kv';
    const l = document.createElement('div');
    l.className = 'mp-kv-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = `mp-kv-value${modifier ? ` ${modifier}` : ''}`;
    v.textContent = value;
    kv.appendChild(l);
    kv.appendChild(v);
    return kv;
}

function makeSectionHeader(label: string, colClass = ''): HTMLElement {
    const h = document.createElement('div');
    h.className = `mp-section-header${colClass ? ` ${colClass}` : ''}`;
    h.textContent = label;
    return h;
}

function makeDivider(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'mp-divider';
    return d;
}

function buildSparklineSVG(dataPoints: number[]): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 120 20');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:20px;display:block';

    const pts = dataPoints.slice(-10);
    if (pts.length < 2) return svg;

    const minV = Math.min(...pts);
    const maxV = Math.max(...pts);
    const range = maxV - minV || 1;
    const pad = 2;

    const coords = pts.map((v, i) => {
        const x = (i / (pts.length - 1)) * 120;
        const y = 20 - pad - ((v - minV) / range) * (20 - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const polyline = document.createElementNS(ns, 'polyline');
    polyline.setAttribute('points', coords);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', 'rgba(33,128,141,0.7)');
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);
    return svg;
}

function renderMetricsTooltipContent(
    el: HTMLElement,
    ticker: string,
    state: MetricsCacheValue,
    livePrice: number | null = null
): void {
    el.textContent = ''; // safe clear — no innerHTML

    // ── Loading / error states ──────────────────────────────────────
    if (state === 'loading' || state === 'error') {
        const hdr = document.createElement('div');
        hdr.className = 'mp-header';
        const tb = document.createElement('div');
        tb.className = 'mp-ticker-block';
        const t = document.createElement('span');
        t.className = 'mp-ticker';
        t.textContent = ticker;
        tb.appendChild(t);
        hdr.appendChild(tb);
        el.appendChild(hdr);

        const body = document.createElement('div');
        body.className = `mp-body mp-state-message${state === 'error' ? ' mp-state-message--error' : ''}`;
        const msg = document.createElement('span');
        msg.textContent = state === 'loading' ? 'Loading fundamentals…' : 'Fundamentals unavailable';
        body.appendChild(msg);
        el.appendChild(body);
        return;
    }

    const m: StockMetrics = state;

    // ── Header ─────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'mp-header';

    const tickerBlock = document.createElement('div');
    tickerBlock.className = 'mp-ticker-block';
    const tickerSpan = document.createElement('span');
    tickerSpan.className = 'mp-ticker';
    tickerSpan.textContent = ticker;
    tickerBlock.appendChild(tickerSpan);
    const displayPrice = livePrice ?? m.currentPrice;
    if (displayPrice !== null) {
        const priceSpan = document.createElement('span');
        priceSpan.className = 'mp-price';
        priceSpan.textContent = `$${displayPrice.toFixed(2)}`;
        tickerBlock.appendChild(priceSpan);
    }

    const headerRight = document.createElement('div');
    headerRight.className = 'mp-header-right';

    const pillsRow = document.createElement('div');
    pillsRow.className = 'mp-meta-row';
    const pillData: [string, string | null][] = [
        ['β ', m.beta !== null ? m.beta.toFixed(2) : null],
        ['Cap ', fmtCap(m.marketCap)],
        ['σ ', m.vol3MonthStd !== null ? `${m.vol3MonthStd.toFixed(0)}%` : null],
    ];
    for (const [prefix, val] of pillData) {
        if (!val || val === '—') continue;
        const pill = document.createElement('span');
        pill.className = 'mp-meta-pill';
        pill.textContent = prefix + val;
        pillsRow.appendChild(pill);
    }
    if (pillsRow.childNodes.length > 0) headerRight.appendChild(pillsRow);

    const returnsRow = document.createElement('div');
    returnsRow.className = 'mp-meta-row';
    const returnData: [string, number | null][] = [
        ['5D', m.return5Day],
        ['52W', m.return52Week],
    ];
    let firstReturn = true;
    for (const [label, val] of returnData) {
        if (val === null) continue;
        if (!firstReturn) {
            const dot = document.createElement('span');
            dot.style.opacity = '0.4';
            dot.textContent = '·';
            returnsRow.appendChild(dot);
        }
        firstReturn = false;
        const span = document.createElement('span');
        span.textContent = `${label} `;
        const strong = document.createElement('strong');
        strong.style.color = val >= 0 ? 'var(--color-success)' : 'var(--color-error)';
        strong.textContent = fmtPct(val, true);
        span.appendChild(strong);
        returnsRow.appendChild(span);
    }
    if (returnsRow.childNodes.length > 0) headerRight.appendChild(returnsRow);

    header.appendChild(tickerBlock);
    header.appendChild(headerRight);
    el.appendChild(header);

    // ── 52W range bar ──────────────────────────────────────────────
    if (m.week52Low !== null && m.week52High !== null) {
        const rangeRow = document.createElement('div');
        rangeRow.className = 'mp-range-row';

        const lowSpan = document.createElement('span');
        lowSpan.className = 'mp-range-low';
        lowSpan.textContent = `$${m.week52Low.toFixed(0)} ▼`;
        const lowDate = fmtDate(m.week52LowDate);
        if (lowDate) lowSpan.title = lowDate;

        const track = document.createElement('div');
        track.className = 'mp-range-track';
        const gradient = document.createElement('div');
        gradient.className = 'mp-range-gradient';
        track.appendChild(gradient);

        const priceForDot = livePrice ?? m.currentPrice;
        if (priceForDot !== null) {
            const rng = m.week52High - m.week52Low;
            if (rng > 0) {
                const pct = Math.min(100, Math.max(0, ((priceForDot - m.week52Low) / rng) * 100));
                const dot = document.createElement('div');
                dot.className = 'mp-range-dot';
                dot.style.left = `${pct.toFixed(1)}%`;
                track.appendChild(dot);
            }
        }

        const highSpan = document.createElement('span');
        highSpan.className = 'mp-range-high';
        highSpan.textContent = `$${m.week52High.toFixed(0)} ▲`;
        const highDate = fmtDate(m.week52HighDate);
        if (highDate) highSpan.title = highDate;

        rangeRow.appendChild(lowSpan);
        rangeRow.appendChild(track);
        rangeRow.appendChild(highSpan);
        el.appendChild(rangeRow);
    }

    // ── Body ───────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'mp-body';

    // Valuation
    const valSection = document.createElement('div');
    valSection.className = 'mp-section';
    valSection.appendChild(makeSectionHeader('Valuation'));
    valSection.appendChild(makeKV('P/E (TTM)', m.peTTM !== null ? `${m.peTTM.toFixed(1)}×` : '—'));
    valSection.appendChild(makeKV('Fwd P/E', m.forwardPE !== null ? `${m.forwardPE.toFixed(1)}×` : '—'));
    valSection.appendChild(makeKV('P/FCF', m.pfcfTTM !== null ? `${m.pfcfTTM.toFixed(1)}×` : '—'));
    valSection.appendChild(makeKV('EV/FCF', m.evFCF !== null ? `${m.evFCF.toFixed(1)}×` : '—'));
    body.appendChild(valSection);
    body.appendChild(makeDivider());

    // Quality
    const posOrNeg = (v: number | null) => v !== null ? (v >= 0 ? 'mp-kv-value--pos' : 'mp-kv-value--neg') : '';
    const qualSection = document.createElement('div');
    qualSection.className = 'mp-section';
    qualSection.appendChild(makeSectionHeader('Quality'));
    qualSection.appendChild(makeKV('Gross Margin', fmtPct(m.grossMarginTTM), posOrNeg(m.grossMarginTTM)));
    qualSection.appendChild(makeKV('FCF Margin', fmtPct(m.fcfMarginLatest), posOrNeg(m.fcfMarginLatest)));
    qualSection.appendChild(makeKV('Op. Margin', fmtPct(m.operatingMarginTTM), posOrNeg(m.operatingMarginTTM)));
    qualSection.appendChild(makeKV('Net Margin', fmtPct(m.netMarginTTM), posOrNeg(m.netMarginTTM)));
    body.appendChild(qualSection);
    body.appendChild(makeDivider());

    // Growth + Balance Sheet
    const growthSign = (v: number | null) => v !== null ? (v > 0 ? 'mp-kv-value--pos' : 'mp-kv-value--neg') : '';
    const gbSection = document.createElement('div');
    gbSection.className = 'mp-section';
    gbSection.appendChild(makeSectionHeader('Growth', 'mp-section-header--col1'));
    gbSection.appendChild(makeSectionHeader('Balance Sheet', 'mp-section-header--col2'));
    gbSection.appendChild(makeKV('Rev YoY', fmtPct(m.revenueGrowthYoY, true), growthSign(m.revenueGrowthYoY)));
    gbSection.appendChild(makeKV('Current Ratio', m.currentRatio !== null ? m.currentRatio.toFixed(2) : '—'));
    gbSection.appendChild(makeKV('EPS YoY', fmtPct(m.epsGrowthYoY, true), growthSign(m.epsGrowthYoY)));
    gbSection.appendChild(makeKV('Net Debt/Eq', m.netDebtToEquity !== null ? m.netDebtToEquity.toFixed(2) : '—'));
    body.appendChild(gbSection);

    // EPS sparkline
    if (m.epsAnnual.length >= 2) {
        body.appendChild(makeDivider());
        const trendSection = document.createElement('div');
        trendSection.className = 'mp-section';
        trendSection.appendChild(makeSectionHeader('10-Year Trends'));
        body.appendChild(trendSection);

        const sparkItem = document.createElement('div');
        sparkItem.className = 'mp-sparkline-item';
        const sparkLabel = document.createElement('span');
        sparkLabel.className = 'mp-sparkline-label';
        sparkLabel.textContent = 'EPS';
        const svgEl = buildSparklineSVG(m.epsAnnual.map(p => p.v));
        const lastEPS = m.epsAnnual[m.epsAnnual.length - 1]?.v ?? null;
        const sparkLast = document.createElement('span');
        sparkLast.className = 'mp-sparkline-last';
        sparkLast.textContent = lastEPS !== null ? `$${lastEPS.toFixed(2)}` : '—';
        sparkItem.appendChild(sparkLabel);
        sparkItem.appendChild(svgEl);
        sparkItem.appendChild(sparkLast);
        body.appendChild(sparkItem);
    }

    el.appendChild(body);
}

function createQuoteRenderer(
    this: ActivePositionsContext,
    quoteEntries: Map<string, Record<string, unknown>>,
    params: ICellRendererParams<TradeRecord>
): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'quote-cell';
    const trade = params.data;
    if (!trade) {
        cell.textContent = '—';
        return cell;
    }

    const rowProxy = document.createElement('div');
    const tickerValue = ((trade.ticker ?? '') as string).toString().trim().toUpperCase();
    const strike = resolveActiveStrike.call(this, trade);
    const dteValue = this.parseInteger(trade.dte, null, { allowNegative: false });

    rowProxy.dataset.ticker = tickerValue;
    if (Number.isFinite(strike)) {
        rowProxy.dataset.strikePrice = String(strike);
    }
    if (Number.isFinite(dteValue)) {
        rowProxy.dataset.dte = String(dteValue);
    }

    const baseQuoteKey = this.getQuoteEntryKey(trade);
    const quoteKey = `${baseQuoteKey}|row:${quoteEntries.size}`;
    rowProxy.dataset.quoteKey = quoteKey;
    this.populateQuoteCell(cell, trade, rowProxy, { deferNetworkFetch: true });
    quoteEntries.set(quoteKey, { trade, row: rowProxy, cell, key: quoteKey });
    return cell;
}

function buildActivePositionsColumnDefs(
    this: ActivePositionsContext,
    quoteEntries: Map<string, Record<string, unknown>>
): ColDef<TradeRecord>[] {
    return [
        {
            colId: 'ticker',
            field: 'ticker',
            headerName: 'Ticker',
            width: 120,
            pinned: 'left',
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
                const tickerValue = ((params.value ?? '') as string).toString().trim().toUpperCase();
                const tickerEl = this.createTickerElement(params.value, 'ticker-pill', {
                    behavior: 'filter',
                    onClick: (value: unknown) => this.openTradesFilteredByTicker(value),
                    title: tickerValue ? `View all trades for ${tickerValue}` : ''
                });

                if (!tickerValue || !this.finnhub?.apiKey) return tickerEl;

                let tooltipEl: HTMLElement | null = null;

                tickerEl.addEventListener('mouseenter', async () => {
                    if (!tooltipEl) {
                        tooltipEl = createMetricsTooltipEl(tickerValue);
                    }
                    // Read current price from quote cache at render time — not at fetch time
                    const livePrice = this.finnhub.cache.get(tickerValue)?.c ?? null;

                    const cached = this.metricsCache.get(tickerValue);
                    if (!cached) {
                        this.metricsCache.set(tickerValue, 'loading');
                        renderMetricsTooltipContent(tooltipEl, tickerValue, 'loading', livePrice);
                        tooltipEl.classList.add('is-visible');
                        this.positionFormulaTooltip(tickerEl, tooltipEl);
                        const result = await this.fetchStockMetrics(tickerValue);
                        const newState: MetricsCacheValue = result ?? 'error';
                        this.metricsCache.set(tickerValue, newState);
                        renderMetricsTooltipContent(tooltipEl, tickerValue, newState, livePrice);
                        if (tooltipEl.classList.contains('is-visible')) {
                            this.positionFormulaTooltip(tickerEl, tooltipEl);
                        }
                    } else {
                        renderMetricsTooltipContent(tooltipEl, tickerValue, cached, livePrice);
                        tooltipEl.classList.add('is-visible');
                        this.positionFormulaTooltip(tickerEl, tooltipEl);
                    }
                });

                tickerEl.addEventListener('mouseleave', () => {
                    tooltipEl?.classList.remove('is-visible');
                });

                return tickerEl;
            },
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'strategy',
            field: 'strategy',
            headerName: 'Strategy',
            minWidth: 180,
            flex: 1,
            valueFormatter: params => (params.value as string) || '—',
            filter: 'agTextColumnFilter'
        },
        {
            colId: 'strike',
            headerName: 'Strike',
            width: 110,
            valueGetter: params => params.data ? resolveActiveStrike.call(this, params.data) : null,
            valueFormatter: params => {
                const value = Number(params.value);
                return Number.isFinite(value)
                    ? (this.formatNumber(value, { style: 'currency', decimals: 2 }) ?? '—')
                    : '—';
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'currentPrice',
            headerName: 'Current Price',
            width: 145,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => createQuoteRenderer.call(this, quoteEntries, params)
        },
        {
            colId: 'dte',
            field: 'dte',
            headerName: 'DTE',
            width: 120,
            valueGetter: params => this.parseInteger(params.data?.dte, null, { allowNegative: false }),
            cellRenderer: (params: ICellRendererParams<TradeRecord>) => {
                const trade = params.data;
                const dteValue = this.parseInteger(trade?.dte, null, { allowNegative: false });

                const cell = document.createElement('div');
                cell.style.cssText = 'display:flex;align-items:center;gap:4px';

                const dteSpan = document.createElement('span');
                dteSpan.textContent = Number.isFinite(dteValue) ? String(dteValue) : '—';
                cell.appendChild(dteSpan);

                if (trade) {
                    if (params.eGridCell) {
                        this.updateExpirationHighlight(params.eGridCell, trade);
                    }
                    const earningsDate = this.getEarningsDateForTrade(trade);
                    if (earningsDate) {
                        const badge = document.createElement('span');
                        badge.className = 'earnings-badge';
                        badge.textContent = '📅 Earnings';
                        badge.title = `Earnings: ${this.formatDate(earningsDate)}`;
                        cell.appendChild(badge);
                    }
                }
                return cell;
            },
            cellClass: params => {
                const probe = document.createElement('span');
                if (params.data) {
                    this.updateExpirationHighlight(probe, params.data);
                }
                return Array.from(probe.classList).join(' ');
            },
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'maxRisk',
            field: 'maxRisk',
            headerName: 'Max Risk',
            width: 125,
            valueGetter: params => this.parseDecimal(params.data?.maxRisk, null, { allowNegative: false }),
            valueFormatter: params => Number.isFinite(params.value as number) ? this.formatCurrency(params.value) : '—',
            cellClass: params => Number.isFinite(params.value as number) ? 'pl-negative' : 'pl-neutral',
            filter: 'agNumberColumnFilter'
        },
        {
            colId: 'notes',
            field: 'notes',
            headerName: 'Notes',
            minWidth: 180,
            flex: 1,
            valueFormatter: params => ((params.value || '') as string).trim() || '—',
            cellClass: 'notes-cell',
            tooltipValueGetter: params => ((params.value || '') as string).trim()
        }
    ];
}

function createActivePositionsGridOptions(
    this: ActivePositionsContext,
    rows: TradeRecord[],
    quoteEntries: Map<string, Record<string, unknown>>
): GridOptions<TradeRecord> {
    return {
        rowData: rows,
        columnDefs: buildActivePositionsColumnDefs.call(this, quoteEntries),
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            minWidth: 90
        },
        rowClassRules: {
            'earnings-risk-row': (params: { data?: TradeRecord }) => !!this.getEarningsDateForTrade(params.data ?? {})
        },
        getRowId: params => activeRowKey(params.data),
        domLayout: 'autoHeight',
        rowHeight: 46,
        headerHeight: 44,
        rowBuffer: 10,
        animateRows: false,
        overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No active positions.</span>'
    };
}

export function updateActivePositionsTable(
    this: ActivePositionsContext,
    openTrades: TradeRecord[] = (this.trades as TradeRecord[]).filter(trade => {
        if ((trade as TradeRecord & { lifecycleStatus?: string }).lifecycleStatus === 'awaiting_coverage') {
            return false;
        }
        if (this.isActiveStatus(trade.status)) {
            if (this.isWheelOrPmccTrade(trade) || this.isAssignmentTrade(trade)) {
                return this.hasNonExpiredOpenShortOptions(trade);
            }
            return true;
        }
        if (this.isAssignmentTrade(trade) && this.isWheelOrPmccTrade(trade)) {
            return this.hasNonExpiredOpenShortOptions(trade);
        }
        return false;
    })
): void {
    const gridRoot = document.getElementById('active-positions-table') as HTMLElement | null;
    if (!gridRoot) {
        return;
    }

    const sortedTrades = [...(Array.isArray(openTrades) ? openTrades : [])].sort((a, b) => {
        const dteA = this.parseInteger(a.dte, Number.POSITIVE_INFINITY, { allowNegative: false }) ?? Number.POSITIVE_INFINITY;
        const dteB = this.parseInteger(b.dte, Number.POSITIVE_INFINITY, { allowNegative: false }) ?? Number.POSITIVE_INFINITY;
        return dteA - dteB;
    });

    document.querySelectorAll('body > .metrics-popup').forEach(el => el.remove());

    const quoteEntries = new Map<string, Record<string, unknown>>();
    if (!this.activePositionsGridApi || this.activePositionsGridApi.isDestroyed()) {
        this.activePositionsGridApi = createGrid(
            gridRoot,
            createActivePositionsGridOptions.call(this, sortedTrades, quoteEntries)
        );
    } else {
        this.activePositionsGridApi.updateGridOptions({
            columnDefs: buildActivePositionsColumnDefs.call(this, quoteEntries),
            rowData: sortedTrades
        });
    }

    this.activeQuoteEntries = quoteEntries;
    this.rebuildQuoteRefreshSchedule();
    this.startQuoteAutoRefreshIfNeeded();
    this.refreshActivePositionsQuotes({ force: true, immediate: true });
}
