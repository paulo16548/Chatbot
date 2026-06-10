# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A WhatsApp support chatbot for the **DTE / SME** (a Brazilian municipal education department). It answers staff questions about institutional e-mail, SME forms/spreadsheets, and the "Educ+" system, collecting the user's data and routing them to a human attendant. All user-facing text is in Brazilian Portuguese — keep new messages in pt-BR.

## Commands

There are no npm scripts. Run directly:

```bash
node chatbot.js
```

On first run a QR code is printed to the terminal (via `qrcode-terminal`); scan it from WhatsApp to authenticate. Session credentials are persisted by `LocalAuth` under `.wwebjs_auth/`, so re-scanning is only needed on logout. The browser session is driven by `whatsapp-web.js` over headless Puppeteer (Chromium) with `--no-sandbox` flags — running it requires a Chromium-capable environment.

## Árvore de atendimento (resumida)

Menu principal (`enviarMenuPrincipal`) com 3 opções:

- **1 — E-mail institucional** → submenu (`MENU_EMAIL`):
  - 1 Criar e-mail · 2 Redefinir senha · 3 Verificação em duas etapas → todas iniciam **coleta de dados** (sem foto) → confirmação.
- **2 — Formulários e planilhas da SME** → **coleta de dados + descrição/foto** → confirmação.
- **3 — Educ+** → pergunta "você é professor?" (`PERGUNTA_PROFESSOR`):
  - **Sim → ramo professor** (`MENU_PROFESSOR`): 1 Problemas de acesso · 2 Apontamentos (ambos coleta sem foto) · 3 Acesso aos tutoriais (link do Drive, encerra) · 4 Outro problema (coleta + foto).
  - **Não → ramo gestor** (`MENU_GESTOR`): 1 Problemas de acesso (coleta sem foto) · 2 Incluir professor no quadro de horários (pede lista `nome - matrícula - função`, confirma) · 3 Acesso aos tutoriais (link do Drive, encerra) · 4 Outro problema (coleta + foto).

## Architecture

The entire bot is `chatbot.js`. It is a **per-user state machine** held in process memory:

- `estadoUsuario[numero]` — maps a WhatsApp number to its current `{ etapa, ... }` (step). Presence of an entry means the user is mid-flow.
- `usuariosComMenuEnviado` (Set) — numbers already shown the main menu, to avoid re-greeting on every message. Cleared automatically once per calendar day (`ultimoDia` check at the top of the `message` handler) and manually when a user sends `menu` / `reiniciar`.

### Máquina de estados — `estadoUsuario[numero].etapa`

- `menu_principal` — usuário viu o menu; aguarda 1/2/3.
- `submenu_email` — dentro de E-mail institucional; aguarda 1/2/3 → inicia coleta sem foto.
- `educ_professor` — pergunta "é professor?"; 1 Sim → `menu_professor`, 2 Não → `menu_gestor`.
- `menu_professor` — opções do ramo professor (acesso, apontamentos, tutoriais, outro).
- `menu_gestor` — opções do ramo gestor (acesso, incluir professor, tutoriais, outro).
- `coleta_dados` — aguardando nome/matrícula/unidade. Se `estado.pedeFoto`, avança para `coleta_descricao`; senão encerra com confirmação.
- `coleta_descricao` — passo final; qualquer texto/imagem encerra com `CONFIRMACAO`. Também usado pelo "incluir professor no quadro de horários".

### Helpers e constantes principais

- `responderFormatado(msg, texto)` — **único caminho de saída**. Adiciona delays + indicador "digitando…" para parecer humano; reutilize-o em vez de chamar `client.sendMessage` direto.
- `encerrarFluxo(numero)` — `delete estadoUsuario[numero]` **e** remove de `usuariosComMenuEnviado`, permitindo reabrir o menu.
- `ehChatPrivado(numero)` — `true` para sufixo `@c.us` **ou** `@lid`; grupos são ignorados.
- `enviarMenuPrincipal(msg, numero)` — saudação por horário + nome do contato + menu de 3 opções; seta `etapa: "menu_principal"`.
- `iniciarColeta(msg, numero, pedeFoto)` — entra em `coleta_dados`; `pedeFoto=true` adiciona o passo `DESCRICAO_FOTO`.
- Constantes de texto: `RODAPE`, `COLETA_DADOS`, `CONFIRMACAO`, `DESCRICAO_FOTO`, `INVALIDO`, `MENU_EMAIL`, `PERGUNTA_PROFESSOR`, `MENU_PROFESSOR`, `MENU_GESTOR`, `TUTORIAL_PROFESSOR`, `TUTORIAL_GESTOR` (links do Drive), `INCLUIR_PROFESSOR`.
- Logs com timestamp pt-BR: `agora()`, `log(...)`, `logErro(...)`.

### Important caveats

- **State is in-memory only** — restarting the process drops every user's progress and the daily-reset tracker.
- `package.json` lists `openai` and `moment-timezone` as dependencies, but neither is currently imported in `chatbot.js`. Don't assume an LLM or timezone library is wired in; date/time logic uses the native `Date`.
- To add a menu option: add a `case` in the relevant switch that sets a new `etapa`, then handle that `etapa` in `processarFluxo` (ou deixe cair no fallback que encerra com `CONFIRMACAO`).

## Histórico de correções importantes

- Removido `--single-process` do Puppeteer — quebrava o Chromium no Windows.
- `ehChatPrivado` passou a aceitar contatos `@lid` além de `@c.us` (WhatsApp pode entregar com qualquer um dos sufixos).
- `try/catch` envolvendo os handlers (`message` e `processarFluxo`) para um erro não derrubar o processo.
- Graceful shutdown em `SIGINT`/`SIGTERM` (`client.destroy()` antes de `process.exit`), compatível com `pm2 restart`.
- Logs com timestamp em pt-BR via `toLocaleString("pt-BR")`.

## Workflow

Dev local no Windows / VS Code → `commit` + `push` na branch `main` → na VM RedHat o Paulo dá `git pull` + `pm2 restart` para subir a nova versão.
