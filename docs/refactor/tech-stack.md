## Current UI Layer Audit

### Rendering model
Everything is raw DOM imperativism — no virtual DOM, no template engine, no reactivity layer. The single `class GammaLedger` writes directly to the page using `insertRow()`, `insertCell()`, `document.createElement()`, and `innerHTML = ''` to fully rebuild every table on every data change.

### Charts — Chart.js 4 via unversioned CDN
11 `new Chart()` call sites in `app.js`. Every update calls `chart.destroy()` + `new Chart()` — no `chart.update()` / partial re-render. The CDN tag (`cdn.jsdelivr.net/npm/chart.js` with no version pin) is a reliability risk. Types require `@types/chart.js` which is not installed. The payoff diagram relies on a hand-written 60-line `priceLabelPlugin` for canvas annotations. The ticker heatmap is not a Chart.js chart at all — it's a hand-rolled CSS grid populated by inline `rgba()` strings.

**Charts in use:** Monthly P&L (bar), Cumulative P&L (line+fill, range selector), Strategy Performance (horizontal bar), Win Rate (doughnut), Commission Impact (horizontal bar), Ticker Heatmap (CSS grid), Time in Trade (bar), Monte Carlo (multi-path line), Payoff Diagram (line with overlay markers), Share Card snapshot (line → canvas/html2canvas).

### Tables — full DOM rebuild pattern
Five tables. All use `tbody.innerHTML = ''` followed by `insertRow()`/`insertCell()` loops. No virtual scrolling — at 2000 trades, 2000 `<tr>` elements are in the DOM simultaneously causing visible paint pauses. Sorting is 120+ lines of custom switch/compare code. Column definitions are hard-coded in HTML. The merge-selection checkbox state is a `Set<string>` manually synced to DOM checkboxes. There is no pagination.

### Forms — dynamic leg rows via string HTML / createElement
The add/edit trade form assembles leg rows via `insertAdjacentHTML` or `document.createElement`. Validation is imperative (collect errors into array, call `showNotification`). No schema-based validation.

### Modals — `is-hidden` CSS class toggle
Three modal types: static HTML disclaimer (class toggle), AI consent dialog (same), trade detail/payoff modal (dynamically appended `<div>`). No shared modal abstraction, partial focus-trap only on the disclaimer modal.

### Toasts — single `showNotification(msg, type)` method
Creates a `<div>`, appends to `document.body`, auto-removes after timeout. No queue, no ARIA role. ~40 lines.

### AI chat Markdown renderer — 250-line custom parser
Handles bold, italic, headings, lists, blockquotes, fenced code. No streaming.

---

## Recommended Modern Alternatives

### Priority 1 — Apache ECharts v5 (replace Chart.js CDN)

```bash
npm install echarts
```

| | Chart.js (current) | ECharts |
|--|--|--|
| Delivery | CDN unversioned | npm, tree-shakeable |
| TS types | external `@types` | built-in `.d.ts` |
| Update without destroy | ❌ | ✅ `chart.setOption(delta)` |
| Financial candlestick/waterfall | ❌ | ✅ built-in series types |
| Heatmap series | ❌ | ✅ replaces hand-rolled CSS grid |
| Large dataset (100k pts) | slowdown | `series.large: true` progressive render |
| Payoff annotations | custom canvas plugin | `markLine` / `markArea` declarative |
| License | MIT | Apache 2.0 |
| Size (tree-shaken) | ~180 KB | ~100–120 KB for types used |

Remove `<script src="…chart.js">` from `index.html`. Migrate each of the 11 chart methods in `app.js` one-by-one (each is a self-contained method — ideal for incremental conversion).

**Why not alternatives:** Recharts/Victory are React-only. Highcharts is proprietary. D3 is lower-level (same work). Lightweight-charts covers OHLC only. Plotly is 3× the size.

---

### Priority 2 — Zod (schema validation + localStorage guard)

```bash
npm install zod
```

Replaces ~200 lines of imperative form/storage validation with typed schemas. The same schema doubles as the TypeScript type source via `z.infer<>`, eliminating the need for a separate `interface Trade`.

```ts
const LegSchema = z.object({
  type:     z.enum(['CALL', 'PUT', 'STOCK', 'CASH']),
  quantity: z.number().finite().positive(),
  premium:  z.number().finite(),
  fees:     z.number().finite().min(0),
  // …
})

// localStorage guard — eliminates the #1 silent-bug source from phase2-analysis.md §5
const result = z.array(TradeSchema).safeParse(JSON.parse(raw))
if (!result.success) { return [] }
return result.data  // typed as Trade[]
```

Size: ~12 KB min+gz. **Valibot** is a fine ~3 KB alternative with nearly identical API.

---

### Priority 3 — AG Grid Community (All Trades table first)

```bash
npm install ag-grid-community
```

| | Current (DOM rebuild) | AG Grid Community |
|--|--|--|
| Virtual scrolling | ❌ all rows in DOM | ✅ only visible rows rendered |
| 2000-row performance | freeze | smooth 60 fps |
| Column sort | 120 lines custom | built-in, multi-column |
| Column filter | custom `<select>` | built-in per-column filter UI |
| Column resize/reorder | ❌ | ✅ drag-and-drop |
| Row selection/checkboxes | custom Set + DOM sync | built-in selection model |
| CSV export | custom `export.js` | `gridApi.exportDataAsCsv()` |
| TS types | ❌ | `ColDef<Trade>` generic |
| License | — | MIT (Community) |

Start with the All Trades table (most rows, most complexity). The Active Positions and Credit Playbook tables can follow. **TanStack Table** is headless and saves nothing in vanilla JS since you still write all DOM manipulation yourself.

---

### Priority 4 — Native `<dialog>` element (replace modal pattern)

No library needed. Baseline available in all evergreen browsers. Provides:
- Built-in focus trap
- Native backdrop
- `Escape` key handling
- ARIA `role="dialog"` for free

```ts
const el = document.getElementById('trade-modal') as HTMLDialogElement
el.showModal()   // opens with all the above behavior
el.close()
el.addEventListener('close', cleanupPayoffChart)
```

Replaces the `is-hidden` class-toggle hack and manual `escapeHandler` attachment across all three modal types.

---

### Priority 5 — Sonner (replace `showNotification`)

```bash
npm install sonner
```

3 KB, framework-agnostic vanilla adapter, queue management, Promise toasts, ARIA compliant. Replaces the 40-line `showNotification` method:

```ts
import { toast } from 'sonner'
toast.success('Trade saved')
toast.promise(saveDatabase(), { loading: 'Saving…', success: 'Saved!', error: 'Failed' })
```

---

### Priority 6 — `marked` + `DOMPurify` (AI chat)

```bash
npm install marked dompurify
npm install --save-dev @types/marked @types/dompurify
```

Deletes 250 lines of custom Markdown parser. `marked` is 25 KB min+gz and CommonMark-compliant. Always sanitize the output before DOM insertion:

```ts
import { marked } from 'marked'
import DOMPurify from 'dompurify'

messageEl.innerHTML = DOMPurify.sanitize(marked.parse(content) as string)
```

---

### Priority 7 — Vue 3 (Phase 3)

Already the stated target in CLAUDE.md. All P1–P6 libraries have first-class Vue 3 wrappers (`vue-echarts`, `ag-grid-vue3`) — choosing them now means zero chart or table logic changes when Vue 3 lands.

---

### Libraries to skip

| Library | Reason |
|--|--|
| React | Vue 3 is the Phase 3 plan |
| Svelte | No ecosystem alignment with Phase 3 |
| Tailwind | Collides with existing `app.css` design system mid-refactor |
| Highcharts | Proprietary license |
| Lodash | Native array methods + `es-toolkit` (3 KB) suffice |
| Moment.js | Native `Intl` + `date-fns` cover all current date formatting |

---

### Bundle size estimate

| Addition | Size min+gz | Replaces |
|--|--|--|
| ECharts (tree-shaken) | ~110 KB | Chart.js CDN (~180 KB, removed from HTML) |
| AG Grid Community | ~200 KB | ~300 lines table render code |
| Zod | 12 KB | ~200 lines validation |
| marked + DOMPurify | 45 KB | ~250 lines custom Markdown |
| Sonner | 3 KB | ~40 lines `showNotification` |
| **Net delta** | **+~190 KB bundled** | Chart.js CDN dependency eliminated |

TypeScript + Vite tree-shaking will reduce actual shipped sizes for ECharts and AG Grid below the listed totals.