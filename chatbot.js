const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

// Controle de menu enviado
const usuariosComMenuEnviado = new Set();

// Controle de estado do usuário
const estadoUsuario = {};

// Reset diário
let ultimoDia = new Date().getDate();


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
      "--disable-gpu",
      "--single-process"
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
    `${saudacao} ${name}! Eu sou o assistente virtual do DTE.\n\n` +
    `Como posso te ajudar hoje? Digite o número da opção.\n\n` +
    `1 - Ajuda com a senha do e-mail institucional\n` +
    `2 - Criar um e-mail institucional\n` +
    `3 - Ajuda com formulários e planilhas da SME\n` +
    `4 - Verificação de duas etapas do e-mail institucional\n` +
    `5 - Sistema Educa BM (submenu)\n` +
    `6 - Falar com atendente humano\n\n` +
    `Ou digite *menu* para voltar ao início.`
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
      if (numero.endsWith("@c.us")) {
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

    if (gatilhos.test(texto) && numero.endsWith("@c.us")) {

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

        case "1":
          estadoUsuario[numero] = { etapa: "senha_email" };
          return responderFormatado(msg, "Me envie seu *nome completo* e *matrícula* para gerar a nova senha.");

        case "2":
          estadoUsuario[numero] = { etapa: "criar_email" };
          return responderFormatado(msg, "Envie seu *nome completo* e *matrícula* para criarmos seu e-mail institucional.");

        case "3":
          estadoUsuario[numero] = { etapa: "form_sme" };
          return responderFormatado(msg,
            "Me envie as seguintes informações:\n\n" +
            "- Qual formulário ou planilha?\n" +
            "- Qual é a dificuldade?\n" +
            "*Lembre-se:* somente funciona com e-mail institucional."
          );

        case "4":
          estadoUsuario[numero] = { etapa: "duas_etapas" };
          return responderFormatado(msg, "Envie seu *nome completo* e *matrícula*.\nUm atendente irá te ajudar.");

        case "5":
          estadoUsuario[numero] = { etapa: "submenu_educa" };
          return responderFormatado(msg,
            "📘 *Sistema Educa BM*\nEscolha uma opção:\n\n" +
            "5.1 - Problemas de acesso\n" +
            "5.2 - Lançamento de notas\n" +
            "5.3 - Relatórios\n" +
            "5.4 - Outro problema"
          );

        case "6":
          estadoUsuario[numero] = { etapa: "atendente" };
          return responderFormatado(msg,
            "Se puder, envie uma descrição do problema.\n\n" +
            "👨‍💼 Um atendente irá responder por ordem de chamado."
          );
      }

      return responderFormatado(msg, "Opção inválida. Digite apenas números do menu.");
    }

    // ------------------ SUBMENU EDUCA BM ------------------
    if (estado.etapa === "submenu_educa") {

      const perguntas = {
        "5.1": "Certo! Qual problema de acesso você está enfrentando?",
        "5.2": "Entendido. Qual dificuldade você encontrou no lançamento de notas?",
        "5.3": "De qual relatório você precisa?",
        "5.4": "Descreva o problema que está acontecendo no Educa BM.",
      };

      if (perguntas[texto]) {
        estadoUsuario[numero] = { etapa: "educa_descricao", subopcao: texto };
        return responderFormatado(msg, perguntas[texto]);
      }

      return responderFormatado(msg, "Opção inválida. Digite *5.1*, *5.2*, *5.3* ou *5.4*.");
    }

    // ------------------ COLETA DA DESCRIÇÃO DO EDUCA BM ------------------
    if (estado.etapa === "educa_descricao") {
      encerrarFluxo(numero);
      return responderFormatado(msg, "Informações recebidas! Um atendente dará continuidade ao processo.");
    }

    // ------------------ QUALQUER OUTRA ETAPA ------------------
    // Aqui, após coletar a informação, encerramos o fluxo.
    encerrarFluxo(numero);
    return responderFormatado(msg, "Informações recebidas! Um atendente dará continuidade ao processo.");
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
