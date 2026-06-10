const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

// Controle de menu enviado
const usuariosComMenuEnviado = new Set();

// Controle de estado do usuário
const estadoUsuario = {};

// Reset diário
let ultimoDia = new Date().getDate();

// Identifica chats privados (WhatsApp pode entregar com sufixo @c.us ou @lid)
const ehChatPrivado = (numero) => numero.endsWith("@c.us") || numero.endsWith("@lid");


// ======================================================================
// MENSAGENS REUTILIZÁVEIS
// ======================================================================
const RODAPE = "Ou digite *menu* para voltar ao início.";
const COLETA_DADOS = "Por favor, informe seu nome completo, matrícula e unidade de ensino.";
const CONFIRMACAO = "Informações recebidas! Um atendente dará continuidade ao processo.";
const DESCRICAO_FOTO = "Agora envie uma descrição do problema e, se possível, uma foto mostrando o que está acontecendo.";
const INVALIDO = "Opção inválida. Digite o número de uma das opções.";

const MENU_EMAIL =
  "✉️ *E-mail institucional*\nEscolha uma opção:\n\n" +
  "1 - Criar e-mail institucional\n" +
  "2 - Redefinir senha do e-mail\n" +
  "3 - Verificação em duas etapas\n\n" +
  RODAPE;

const PERGUNTA_PROFESSOR =
  "📘 Sistema Educ+. Você utiliza o sistema como professor?\n\n" +
  "1 - Sim\n2 - Não\n\n" +
  RODAPE;

const MENU_PROFESSOR =
  "👨‍🏫 *Educ+ — Professor*\nEscolha uma opção:\n\n" +
  "1 - Problemas de acesso\n" +
  "2 - Apontamentos\n" +
  "3 - Acesso aos tutoriais\n" +
  "4 - Outro problema\n\n" +
  RODAPE;

const MENU_GESTOR =
  "🧑‍💼 *Educ+ — Gestor*\nEscolha uma opção:\n\n" +
  "1 - Problemas de acesso\n" +
  "2 - Incluir professor no quadro de horários\n" +
  "3 - Acesso aos tutoriais\n" +
  "4 - Outro problema\n\n" +
  RODAPE;

const TUTORIAL_PROFESSOR =
  "Aqui estão os tutoriais para professores:\n" +
  "https://drive.google.com/drive/folders/14AtcoUeTJAZUvytcfGtZSeQjEjcdM4XK\n\n" +
  RODAPE;

const TUTORIAL_GESTOR =
  "Aqui estão os tutoriais para gestores:\n" +
  "https://drive.google.com/drive/folders/1ohZxJ8AdeY_o2I898u342ZxqXtX_cLzj\n\n" +
  RODAPE;

const INCLUIR_PROFESSOR =
  "Informe os dados do professor em uma lista, no formato *nome - matrícula - função*. Exemplo:\n\n" +
  "Maria Silva - 700900 - Regente\n" +
  "Carla Souza - 701800 - Tecnomaker\n" +
  "Antônio Santos - 702700 - Ed. Física";


// ======================================================================
// LOGS COM TIMESTAMP (pt-BR)
// ======================================================================
const agora = () => new Date().toLocaleString("pt-BR");
const log = (...args) => console.log(`[${agora()}]`, ...args);
const logErro = (...args) => console.error(`[${agora()}]`, ...args);


const client = new Client({
  auth: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ],
  },
});

client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => log("Tudo certo! WhatsApp conectado."));
client.on("disconnected", r => client.initialize());

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));


// ======================================================================
// ENCERRAR FLUXO (libera estado E permite reabrir o menu)
// ======================================================================
function encerrarFluxo(numero) {
  delete estadoUsuario[numero];
  usuariosComMenuEnviado.delete(numero);
}


// ======================================================================
// FUNÇÃO DE ENVIAR MENSAGEM COM DIGITAÇÃO REALISTA
// ======================================================================
async function responderFormatado(msg, texto) {
  const chat = await msg.getChat();
  await delay(1500);
  await chat.sendStateTyping();
  await delay(2000);
  await client.sendMessage(msg.from, texto);
}


// ======================================================================
// INICIA UMA ETAPA DE COLETA DE DADOS
// pedeFoto=true -> COLETA_DADOS -> DESCRICAO_FOTO -> CONFIRMACAO
// pedeFoto=false -> COLETA_DADOS -> CONFIRMACAO
// ======================================================================
function iniciarColeta(msg, numero, pedeFoto) {
  estadoUsuario[numero] = { etapa: "coleta_dados", pedeFoto };
  return responderFormatado(msg, COLETA_DADOS);
}


// ======================================================================
// ENVIO DO MENU PRINCIPAL
// ======================================================================
async function enviarMenuPrincipal(msg, numero) {
  usuariosComMenuEnviado.add(numero);

  // Saudação automática
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom dia" :
    hora < 18 ? "Boa tarde" :
    "Boa noite";

  const contact = await msg.getContact();
  const name = contact.pushname?.split(" ")[0] ?? "usuário";

  await responderFormatado(msg,
    `${saudacao} ${name}! Eu sou o assistente virtual do SISTEC.\n\n` +
    `Como posso te ajudar hoje? Digite o número da opção.\n\n` +
    `1 - Ajuda com e-mail institucional\n` +
    `2 - Formulários e planilhas da SME\n` +
    `3 - Sistema Educ+\n\n` +
    RODAPE
  );

  estadoUsuario[numero] = { etapa: "menu_principal" };
}


// ======================================================================
//                   TRATAMENTO DE MENSAGENS
// ======================================================================
client.on("message", async (msg) => {

  const numero = msg.from;

  try {
    const texto = msg.body.toLowerCase().trim();

    // ------------------ RESET DIÁRIO ------------------
    const hoje = new Date().getDate();
    if (hoje !== ultimoDia) {
      usuariosComMenuEnviado.clear();
      log("🔄 Reset diário do menu realizado.");
      ultimoDia = hoje;
    }

    // ------------------ RESET MANUAL (menu / reiniciar) ------------------
    if (["menu", "reiniciar"].includes(texto)) {
      encerrarFluxo(numero);
      log("Atendimento reiniciado manualmente para:", numero);
      if (ehChatPrivado(numero)) {
        return enviarMenuPrincipal(msg, numero);
      }
      return;
    }

    // ------------------ SE ESTÁ EM UM FLUXO, ENTRA NO FLUXO ------------------
    if (estadoUsuario[numero]) {
      return processarFluxo(msg, texto, numero);
    }

    // ------------------ GATILHOS PARA O MENU ------------------
    const gatilhos = /(menu|dia|tarde|noite|oi|olá|ola|sistema|e-mail|senha|institucional)/i;

    if (gatilhos.test(texto) && ehChatPrivado(numero)) {

      // Evitar repetição
      if (usuariosComMenuEnviado.has(numero)) return;

      return enviarMenuPrincipal(msg, numero);
    }
  } catch (err) {
    logErro("Erro no handler de mensagem para", numero, err);
  }
});


// ======================================================================
//                    PROCESSAMENTO DE FLUXO INTELIGENTE
// ======================================================================
async function processarFluxo(msg, texto, numero) {

  try {
    const estado = estadoUsuario[numero];

    // ------------------ MENU PRINCIPAL ------------------
    if (estado.etapa === "menu_principal") {
      switch (texto) {
        case "1": // E-mail institucional -> submenu
          estadoUsuario[numero] = { etapa: "submenu_email" };
          return responderFormatado(msg, MENU_EMAIL);

        case "2": // Formulários e planilhas da SME -> dados + foto
          return iniciarColeta(msg, numero, true);

        case "3": // Sistema Educ+ -> pergunta professor
          estadoUsuario[numero] = { etapa: "educ_professor" };
          return responderFormatado(msg, PERGUNTA_PROFESSOR);
      }
      return responderFormatado(msg, INVALIDO);
    }

    // ------------------ SUBMENU E-MAIL ------------------
    if (estado.etapa === "submenu_email") {
      // 1 - Criar / 2 - Redefinir senha / 3 - Verificação em duas etapas
      if (["1", "2", "3"].includes(texto)) {
        return iniciarColeta(msg, numero, false);
      }
      return responderFormatado(msg, INVALIDO);
    }

    // ------------------ EDUC+ : VOCÊ É PROFESSOR? ------------------
    if (estado.etapa === "educ_professor") {
      if (texto === "1") { // Sim -> menu professor
        estadoUsuario[numero] = { etapa: "menu_professor" };
        return responderFormatado(msg, MENU_PROFESSOR);
      }
      if (texto === "2") { // Não -> menu gestor
        estadoUsuario[numero] = { etapa: "menu_gestor" };
        return responderFormatado(msg, MENU_GESTOR);
      }
      return responderFormatado(msg, INVALIDO);
    }

    // ------------------ MENU PROFESSOR ------------------
    if (estado.etapa === "menu_professor") {
      switch (texto) {
        case "1": // Problemas de acesso
        case "2": // Apontamentos
          return iniciarColeta(msg, numero, false);

        case "3": // Acesso aos tutoriais -> link e encerra
          encerrarFluxo(numero);
          return responderFormatado(msg, TUTORIAL_PROFESSOR);

        case "4": // Outro problema -> dados + foto
          return iniciarColeta(msg, numero, true);
      }
      return responderFormatado(msg, INVALIDO);
    }

    // ------------------ MENU GESTOR ------------------
    if (estado.etapa === "menu_gestor") {
      switch (texto) {
        case "1": // Problemas de acesso
          return iniciarColeta(msg, numero, false);

        case "2": // Incluir professor no quadro de horários -> lista + confirma
          estadoUsuario[numero] = { etapa: "coleta_descricao" };
          return responderFormatado(msg, INCLUIR_PROFESSOR);

        case "3": // Acesso aos tutoriais -> link e encerra
          encerrarFluxo(numero);
          return responderFormatado(msg, TUTORIAL_GESTOR);

        case "4": // Outro problema -> dados + foto
          return iniciarColeta(msg, numero, true);
      }
      return responderFormatado(msg, INVALIDO);
    }

    // ------------------ COLETA DE DADOS (nome, matrícula, unidade) ------------------
    if (estado.etapa === "coleta_dados") {
      if (estado.pedeFoto) {
        estadoUsuario[numero] = { etapa: "coleta_descricao" };
        return responderFormatado(msg, DESCRICAO_FOTO);
      }
      encerrarFluxo(numero);
      return responderFormatado(msg, CONFIRMACAO);
    }

    // ------------------ COLETA DA DESCRIÇÃO / FOTO (passo final) ------------------
    // Aceita texto ou imagem; qualquer mensagem encerra com a confirmação.
    if (estado.etapa === "coleta_descricao") {
      encerrarFluxo(numero);
      return responderFormatado(msg, CONFIRMACAO);
    }

    // ------------------ FALLBACK ------------------
    encerrarFluxo(numero);
    return responderFormatado(msg, CONFIRMACAO);
  } catch (err) {
    logErro("Erro ao processar fluxo para", numero, err);
  }
}


// ======================================================================
//                    ENCERRAMENTO LIMPO (pm2 / SIGINT / SIGTERM)
// ======================================================================
async function shutdown(sinal) {
  log(`Recebido ${sinal}. Encerrando o cliente WhatsApp...`);
  try {
    await client.destroy();
  } catch (err) {
    logErro("Erro ao destruir o cliente:", err);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
