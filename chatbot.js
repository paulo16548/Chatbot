const qrcode = require("qrcode-terminal")
const { Client, Buttons, List, MessageMedia, LocalAuth } = require("whatsapp-web.js") // Mudança Buttons
const client = new Client({
  auth: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
  },
})

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true })
})

client.on("ready", () => {
  console.log("Tudo certo! WhatsApp conectado.")
})

client.on("disconnected", (reason) => {
  console.log("Desconectado. Tentando reconectar...", reason)
  client.initialize()
})

client.initialize()

const delay = (ms) => new Promise((res) => setTimeout(res, ms)) // Função que usamos para criar o delay entre uma ação e outra

client.on("message", async (msg) => {
  if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) && msg.from.endsWith("@c.us")) {
    const chat = await msg.getChat()

    await delay(3000) //delay de 3 segundos
    await chat.sendStateTyping() // Simulando Digitação
    await delay(3000) //Delay de 3000 milisegundos mais conhecido como 3 segundos

    const hora = new Date().getHours()
    let saudacao
    if (hora >= 5 && hora < 12) {
      saudacao = "Bom dia"
    } else if (hora >= 12 && hora < 18) {
      saudacao = "Boa tarde"
    } else {
      saudacao = "Boa noite"
    }

    await client.sendMessage(
      msg.from,
      saudacao +
        "! tudo bem? quem te enviou essa mensagem foi o robô que acabamos de criar, incrível né😎 Viu que incrível voce criou um robo grátis",
    )
    
    await delay(3000) //delay de 3 segundos
    await chat.sendStateTyping() // Simulando Digitação
    await delay(3000) //Delay de 3000 milisegundos mais conhecido como 3 segundos

    await client.sendMessage(msg.from, 'Na versão PRO você vai além: desbloqueie tudo!\n\n' +
            '✍️ Envio de textos\n' +
            '🎙️ Áudios\n' +
            '🖼️ Imagens\n' +
            '🎥 Vídeos\n' +
            '📂 Arquivos\n\n' +
            '💡 Simulação de "digitando..." e "gravando áudio"\n' +
            '🚀 Envio de mensagens em massa\n' +
            '📇 Captura automática de contatos\n' +
            '💻 Aprenda como deixar o robô funcionando 24 hrs, com o PC desligado\n' +
            '✅ E 3 Bônus exclusivos\n\n' +
            '🔥 Adquira a versão PRO agora: https://pay.kiwify.com.br/FkTOhRZ?src=pro');




}
})
