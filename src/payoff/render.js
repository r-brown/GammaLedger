// src/payoff/render.js — Wave 6: Payoff chart toggle and rendering.
// Uses the .call(this, …) delegation pattern.

export function toggleTradePayoffDetail(row, detailRow, trade, chartId, footnoteId) {
    if (!detailRow) {
        return;
    }

    const isOpen = !detailRow.classList.contains('is-open');

    detailRow.classList.toggle('is-open', isOpen);
    detailRow.style.display = isOpen ? 'table-row' : 'none';
    detailRow.setAttribute('aria-hidden', String(!isOpen));
    row?.setAttribute('aria-expanded', String(isOpen));

    const detailCanvas = detailRow.querySelector('canvas');
    if (detailCanvas) {
        detailCanvas.setAttribute('aria-hidden', String(!isOpen));
    }

    if (isOpen) {
        const renderPromise = this.renderTradePayoffChart(trade, chartId, footnoteId);
        if (renderPromise?.catch) {
            renderPromise.catch(error => {
                console.error('Failed to render payoff chart:', error);
            });
        }
    } else {
        this.destroyTradePayoffChart(chartId, footnoteId);
    }
}

export function destroyTradePayoffChart(chartId, footnoteId) {
    const existingChart = this.tradeDetailCharts?.get(chartId);
    if (existingChart) {
        try {
            existingChart.destroy();
        } catch (error) {
            console.warn('Failed to destroy payoff chart:', error);
        }
        this.tradeDetailCharts.delete(chartId);
    }

    const canvas = document.getElementById(chartId);
    const wrapper = canvas?.parentElement;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.classList.remove('hidden');
    }
    wrapper?.classList.remove('trade-diagram__canvas--empty');

    if (footnoteId) {
        const footnote = document.getElementById(footnoteId);
        if (footnote) {
            footnote.textContent = 'Tap or click the trade row to generate the payoff diagram.';
        }
    }
}
