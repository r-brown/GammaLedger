# GammaLedger MCP

**Ask an AI assistant questions about your own options trades.**

GammaLedger MCP connects AI assistants such as Claude, Hermes or Grok (any app that supports MCP) to your [GammaLedger](https://gammaledger.com) trading journal. Once it is set up you can simply ask:

- *"How is my portfolio doing this month?"*
- *"Which positions expire this week, and are any of them losing money?"*
- *"Show every SPY trade I closed in 2026 and what I made on them."*
- *"What were my five worst trades, and which strategy were they?"*
- *"Is my Wheel position on NVDA fully covered?"*

It is **read-only** (the assistant can look, never change anything), it runs on **your computer**, and it needs **no account or API key**. Your trades are only shared with the AI app you chose to connect.

> This is an educational and analytical tool, not financial advice. See the disclaimer at the bottom of this page.

---

## Contents

1. [What you need](#what-you-need)
2. [Quick start](#quick-start) — three steps, about five minutes
3. [Keeping your data fresh](#keeping-your-data-fresh)
4. [What the assistant can do](#what-the-assistant-can-do)
5. [How profit & loss numbers are produced](#how-profit--loss-numbers-are-produced)
6. [Other ways to connect](#other-ways-to-connect) — Hermes, folders, remote files, and web apps
7. [Settings reference](#settings-reference)
8. [Troubleshooting](#troubleshooting)
9. [Privacy and security](#privacy-and-security)

---

## What you need

| You need | Why | How to get it |
|---|---|---|
| A saved GammaLedger database file | This is the file the assistant reads. | In the GammaLedger app: **Settings → Save Database**. |
| `uv` (a small free tool) | Downloads and runs GammaLedger MCP for you. | See [step 2](#2-install-uv) below. |
| An AI app that supports MCP | The assistant you will chat with. | [Claude Desktop](https://claude.ai/download), [Claude Code](https://claude.com/claude-code), Hermes, and others. |

You do **not** need to know Python or use a terminal beyond pasting one or two commands.

---

## Quick start

### 1. Save your database from GammaLedger

1. Open the GammaLedger app.
2. Go to **Settings → Save Database**.
3. Save the file somewhere easy to remember, for example `gammaledger.json` in your home folder.

Remember the full path to that file. It will look like `/Users/you/gammaledger.json` (Mac), `/home/you/gammaledger.json` (Linux) or `C:\Users\you\gammaledger.json` (Windows).

### 2. Install `uv`

`uv` is a tool that runs GammaLedger MCP without any manual installation. Install it once.

**Mac or Linux** — open *Terminal* and paste:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows** — open *PowerShell* and paste:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Then close and reopen the terminal. To check it worked, run `uvx --version`; you should see a version number.

### 3. Connect your AI app

Pick the app you use.

#### Claude Desktop

1. In Claude Desktop open **Settings → Developer → Edit Config**. This opens the file `claude_desktop_config.json`.
   (Or open it by hand: `~/Library/Application Support/Claude/claude_desktop_config.json` on a Mac, `%APPDATA%\Claude\claude_desktop_config.json` on Windows.)
2. Add GammaLedger, replacing the path with **your own** file from step 1:

   ```json
   {
     "mcpServers": {
       "gammaledger": {
         "command": "uvx",
         "args": ["gammaledger-mcp", "--db-path", "/Users/you/gammaledger.json"]
       }
     }
   }
   ```

   If the file already lists other servers, add `"gammaledger": { ... }` next to them inside `mcpServers`.
3. **Quit and reopen Claude Desktop** completely.

#### Claude Code

Run this once (replace the path with your own):

```bash
claude mcp add gammaledger -- uvx gammaledger-mcp --db-path ~/gammaledger.json
```

#### Any other MCP app

Use the command `uvx` with the arguments `gammaledger-mcp --db-path <your file>`. Example config files are in the [`examples/` folder](https://github.com/r-brown/GammaLedger/tree/main/mcp/examples).

### Check that it works

Start a new chat and ask:

> *"Check my GammaLedger database."*

The assistant should report how many trades it found, the date of your export and whether the data is fresh. If it reports a problem instead, see [Troubleshooting](#troubleshooting).

---

## Keeping your data fresh

The assistant reads the file you saved, **not** the live app. It is a snapshot of the moment you clicked *Save Database*. Open positions, days-to-expiration and profit & loss are all as of that moment.

- **After trading, save the database again** (same file name, overwrite). The assistant notices the new file the next time you ask a question (a file on the web is re-checked about once a minute); there is nothing to restart.
- **You are warned when the file is old.** If the export is more than 3 days old, the assistant is told so (`isStale`) and should tell you instead of presenting last week's positions as today's. Change the limit with `--stale-days` (see [settings](#settings-reference)).
- **Syncing the file to another computer?** If a sync tool is halfway through replacing the file when you ask a question, the assistant keeps using the previous copy and flags it, rather than failing.

---

## What the assistant can do

You never call these yourself — just ask in plain language and the assistant picks the right one.

| Ask about… | What it looks up |
|---|---|
| **The database itself** | Which file is loaded, how many trades, when it was exported, how old it is, and any warnings. |
| **Your whole portfolio** | Win rate, profit factor, Sharpe/Sortino, drawdown, fees, current streak, best and worst trade. |
| **Profit & loss over time** | Today's totals plus this week / month / quarter / year-to-date / last 12 months. |
| **Open positions** | Everything currently open, filterable by ticker, strategy, days to expiration, or losers only. |
| **One specific trade** | Every leg, date and note for a trade like `TRD-0042`, plus its profit & loss. |
| **Your whole trade history** | Search by ticker, strategy, status, date opened/closed, and profit & loss range — see below. |
| **Wheel and PMCC positions** | Cost basis, premium collected, and whether your shares are covered by calls. |
| **Risk** | Concentration, positions expiring soon, losers, and a one-shot risk audit sorted by severity. |
| **Performance breakdowns** | Results per strategy, per ticker, and per type of underlying (stock, ETF, index, future). |
| **Your watchlist** | Followed tickers with your rating, notes and target price. |

The assistant also has ready-made guided reviews you can request by name: *analyze_portfolio*, *risk_audit*, *wheel_pmcc_review*, *weekly_review* and *position_inspect*.

### Searching your trade history

Searching covers **every trade you have ever recorded**, not just recent ones. You can combine any of these:

| Filter | Example question |
|---|---|
| Ticker, strategy, status | *"All my closed Iron Condors on SPY."* |
| Opened / closed between two dates | *"Trades I closed between January and March 2026."* |
| Profit & loss range | *"Everything that lost more than $200."* |
| Sorting | *"My ten biggest winners, best first."* |

The answer also includes the **total profit & loss across all matches**, so *"how much did I make on QQQ in 2026?"* takes a single lookup.

**Keeping answers short.** To save the assistant's working memory, lists show only the essentials by default (id, ticker, strategy, status, dates, P&L…). Ask for more detail and it will fetch it — for example *"include the notes and entry price for my open positions."*

---

## How profit & loss numbers are produced

Every trade P&L is labelled with where it came from (`plSource`):

| Label | Meaning |
|---|---|
| **`app`** | Calculated by GammaLedger itself and stored in the file. This covers open positions, Wheel/PMCC positions and your 10 most recent closed trades. |
| **`derived`** | The app did not store a figure for this older closed trade, so GammaLedger MCP adds up the trade's own legs using the same rules as the app: *money received − money paid − fees*. This covers **Closed and Expired** trades. |
| *(blank)* | No figure is available — for example an open trade the app did not include, or a closed trade imported without any legs. The assistant is told "unknown" rather than given a guess. |

Return on investment (ROI) is only shown for `app` figures — it depends on GammaLedger's per-strategy risk calculation. (`derived` trades get an ROI only if you set a *max risk* on the trade yourself.)

Portfolio totals and the per-strategy and per-ticker breakdowns always come from GammaLedger and cover every trade.

---

## Other ways to connect

### Hermes Agent

Add this to `~/.hermes/config.yaml`, then restart Hermes. `uv` must be installed on the Hermes machine.

```yaml
mcp_servers:
  gammaledger:
    command: "uvx"
    args: ["gammaledger-mcp"]
    env:
      GAMMALEDGER_DB_PATH: "/home/hermes/gammaledger/gammaledger.json"
```

### A folder of saved databases

If you keep several exports in one folder, point at the folder instead of a file:

```bash
uvx gammaledger-mcp --db-path ~/GammaLedger/
```

It uses `gammaledger.json` if present, otherwise the newest `.json` file that looks like a GammaLedger database.

### A file hosted on the web

If your database is on a server you control, use its address (`https://…`). Set `GAMMALEDGER_DB_TOKEN` if it needs a password-style token.

```bash
uvx gammaledger-mcp --db-url https://example.com/gammaledger.json
```

### Web apps and other computers (HTTP mode)

By default GammaLedger MCP talks to an app running **on the same computer**. To let a web-based assistant — or an assistant on another machine — reach it, run it as a small web service instead:

```bash
export GAMMALEDGER_MCP_TOKEN="choose-a-long-random-secret"
uvx gammaledger-mcp --db-path ~/gammaledger.json --http --port 8765 \
  --allowed-host mcp.example.com
```

- The assistant connects to `https://mcp.example.com/mcp` and sends the secret as `Authorization: Bearer <secret>`.
- **Always put HTTPS in front** (Caddy, nginx, a gateway…). GammaLedger MCP itself speaks plain HTTP and listens only on your own machine (`127.0.0.1`) unless you say otherwise. A minimal Caddy setup:

  ```
  mcp.example.com {
      reverse_proxy 127.0.0.1:8765
  }
  ```
- `--allowed-host` is the public name people use to reach you. Without it, requests that arrive under that name are refused with *"Invalid Host header"*.
- If you listen on a non-local address (`--host 0.0.0.0`) the server **refuses to start without a secret**.
- `http://…/healthz` answers `ok` without a secret, handy for uptime checks.
- Web assistants that only support OAuth sign-in (not a fixed secret) need an authentication gateway in front.

---

## Settings reference

Every setting can be a command-line option or an environment variable. In AI-app config files, environment variables go under `env`.

| Command-line option | Environment variable | What it does | Default |
|---|---|---|---|
| `--db-path FILE_OR_FOLDER` | `GAMMALEDGER_DB_PATH` | Where your saved database is. | `~/gammaledger.json` |
| `--db-url URL` | `GAMMALEDGER_DB_URL` | Use a web address instead. Takes priority over `--db-path`. | – |
| – | `GAMMALEDGER_DB_TOKEN` | Secret sent to the web address (HTTPS only). | – |
| `--refresh-seconds N` | `GAMMALEDGER_DB_REFRESH_SECONDS` | How often a web database is re-checked. | `60` |
| `--stale-days N` | `GAMMALEDGER_STALE_DAYS` | Warn when the export is older than this many days. | `3` |
| `--http` | – | Run as a web service instead of talking to a local app. | off |
| `--host ADDRESS` | – | Address to listen on in HTTP mode. | `127.0.0.1` |
| `--port N` | – | Port in HTTP mode. | `8765` |
| `--path /PATH` | – | URL path of the endpoint in HTTP mode. | `/mcp` |
| – | `GAMMALEDGER_MCP_TOKEN` | Secret that web clients must send. (`--token` also works but is visible to other users on the machine.) | – |
| `--allowed-host NAME` | – | Public host name for use behind a proxy; repeat for several. | – |
| `-v` | `GAMMALEDGER_MCP_VERBOSE=1` | Detailed logging, for troubleshooting. | off |
| `--version` | – | Print the version and exit. | – |

Where the database is taken from, first match wins: `--db-url` → `--db-path` → `GAMMALEDGER_DB_URL` → `GAMMALEDGER_DB_PATH` → `~/gammaledger.json`.

**Pinning or updating.** `uvx gammaledger-mcp@1.2.3 …` runs an exact release. To fetch the newest release, run `uvx --refresh gammaledger-mcp --version` once.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| The AI app says the server failed to start, or never shows GammaLedger tools. | Quit and fully reopen the app after editing its config. Check the JSON for typos (a missing comma or quote is the usual culprit). |
| **`uvx: command not found`** (or the app cannot find `uvx`). | Apps started from the dock/Start menu may not see your terminal's PATH. In a terminal run `which uvx` (Mac/Linux) or `where uvx` (Windows) and put that **full path** in the config as `"command"`. |
| **"GammaLedger database not found"** | The path is wrong. Check it is the *full* path and the file exists. Re-save from **Settings → Save Database** if needed. |
| **"mcpContext is missing from the database"** | The file was saved by an older GammaLedger. Update the app and save again. Searching trades and viewing a single trade still work without it. |
| The assistant says the data is **stale** / old. | Your last export is more than 3 days old. Save the database again from the app. |
| **"Could not refresh … serving the last good copy"** (`stale: true`). | The file or web address could not be read just now (for example a sync in progress, or no network). The previous copy is still being used and it recovers on its own; if it persists, check the file/URL. |
| A warning about an **unrecognised schema version**. | Your GammaLedger app is newer than this MCP server. Update it with `uvx --refresh gammaledger-mcp --version`. Most things still work. |
| Results look empty for old trades. | Make sure you are on the latest version; older ones only had figures for recent trades. Check `plSource` — see [how P&L is produced](#how-profit--loss-numbers-are-produced). |
| *HTTP mode:* **401 Unauthorized** | The secret the client sends does not match `GAMMALEDGER_MCP_TOKEN`. |
| *HTTP mode:* **421 / "Invalid Host header"** | Add the name people use to reach you: `--allowed-host mcp.example.com`. |
| *HTTP mode:* server refuses to start with `--host 0.0.0.0`. | Set `GAMMALEDGER_MCP_TOKEN` first; a publicly reachable journal must have a secret. |

Still stuck? Run with `-v` for detailed logs (shown on the app's MCP log, or the terminal in HTTP mode) and [open an issue](https://github.com/r-brown/GammaLedger/issues) — without pasting your trading data.

---

## Privacy and security

- **Read-only.** The assistant cannot add, change or delete trades.
- **Local by default.** Nothing leaves your computer except what the AI app you connected sends to its own service when you chat — and that includes any trade details the assistant reads to answer you.
- **No credentials in logs.** Locations are logged as `scheme://host/path` only; tokens and query strings are never printed.
- **Tokens stay safe.** `GAMMALEDGER_DB_TOKEN` is refused over plain `http://` (except on your own machine) and is never forwarded to a different host after a redirect.
- **Your database is your trading history.** Keep the file out of public places, never commit it to a public repository, and if you serve it over HTTP always use HTTPS and a secret.

---

## 📜 License

GammaLedger is open source and free forever under the AGPLv3 license for non-commercial and open-source compliant use. See the [LICENSE](https://github.com/r-brown/GammaLedger/blob/main/LICENSE) file for full terms.

This means you can freely use, modify, and distribute GammaLedger for personal projects, research, or open-source applications, as long as you share any modifications under the same license—especially if deployed over a network (e.g., in SaaS setups).

For proprietary integrations, commercial deployments, or use without sharing your changes (ideal for fintech startups or hedge funds protecting IP), we offer a flexible commercial license. Benefits include:
- No copyleft requirements
- Priority support
- Custom features or indemnification

For commercial use, please contact us to obtain a commercial license


## ⚖️ Disclaimer

This software is for **educational and analytical purposes only**. Options trading involves substantial risk and may not be suitable for all investors. Past performance does not guarantee future results. The AI Coach provides educational insights and is not financial advice. Please consult with a qualified financial advisor before making investment decisions.

**Options Risk Disclosure**: Trading options involves risk and is not suitable for all investors. You could lose more than your initial investment. Please read the Characteristics and Risks of Standardized Options before trading.
