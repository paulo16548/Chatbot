# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A WhatsApp support chatbot for the **DTE / SME** (a Brazilian municipal education department). It answers staff questions about institutional e-mail, passwords, SME forms/spreadsheets, two-factor auth, and the "Educa BM" system, routing users to a human attendant when needed. All user-facing text is in Brazilian Portuguese — keep new messages in pt-BR.

## Commands

There are no npm scripts. Run directly:

```bash
node chatbot.js
```

On first run a QR code is printed to the terminal (via `qrcode-terminal`); scan it from WhatsApp to authenticate. Session credentials are persisted by `LocalAuth` under `.wwebjs_auth/`, so re-scanning is only needed on logout. The browser session is driven by `whatsapp-web.js` over headless Puppeteer (Chromium) with `--no-sandbox` flags — running it requires a Chromium-capable environment.

## Architecture

The entire bot is `chatbot.js`. It is a **per-user state machine** held in process memory:

- `estadoUsuario[numero]` — maps a WhatsApp number to its current `{ etapa }` (step). Presence of an entry means the user is mid-flow.
- `usuariosComMenuEnviado` (Set) — numbers already shown the main menu, to avoid re-greeting on every message. Cleared automatically once per calendar day (`ultimoDia` check at the top of the `message` handler) and manually when a user sends `menu` / `reiniciar`.

Message handling splits into two functions:

1. **`client.on("message", ...)`** — entry point. If the user is already in a flow, it delegates to `processarFluxo`. Otherwise it matches greeting/keyword triggers (the `gatilhos` regex), sends a time-of-day greeting + the numbered main menu, and sets `etapa: "menu_principal"`. Only direct chats are served (`numero.endsWith("@c.us")`) — groups are ignored.
2. **`processarFluxo(msg, texto, numero)`** — the state machine. Branches on `estado.etapa`: `menu_principal` (options 1–6) and `submenu_educa` (5.1–5.4). Most terminal branches `delete estadoUsuario[numero]` to end the flow and hand off to a human.

`responderFormatado` is the only outbound-message path. It deliberately adds delays + a "typing…" indicator to feel human; reuse it for new replies rather than calling `client.sendMessage` directly.

### Important caveats

- **State is in-memory only** — restarting the process drops every user's progress and the daily-reset tracker.
- `package.json` lists `openai` and `moment-timezone` as dependencies, but neither is currently imported in `chatbot.js`. Don't assume an LLM or timezone library is wired in; date/time logic uses the native `Date`.
- To add a menu option: add a `case` in the `menu_principal` switch that sets a new `etapa`, then handle that `etapa` in `processarFluxo` (or let it fall through to the generic "informações recebidas" terminal branch).
