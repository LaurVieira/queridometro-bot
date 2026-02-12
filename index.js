const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require("discord.js");
const cron = require("node-cron");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const TOKEN_DO_BOT = "TOKEN DISCORD";

const PARTICIPANTES = {
  "550493155565240321": "Khloe",
  "231466178600632320": "Fernanda",
  "527485966420803604": "Kehlani",
  "481435037200416779": "Hinata",
  "1183812356795531404": "Mia",
  "285603510660366347": "Priska"
};

const EMOJIS = ["❤","🌼","💣","🍪","🐍","🤮","💼","🤥","💔"];

let votosRecebidos = {}; 
let jaVotou = new Set();
let votacaoAberta = false;
let canalId = null;

function resetarVotacao() {
  votosRecebidos = {};
  for (let id in PARTICIPANTES) {
    votosRecebidos[id] = {};
    EMOJIS.forEach(e => votosRecebidos[id][e] = 0);
  }
  jaVotou.clear();
  votacaoAberta = true;
}

function enviarResultado(canal) {
  let resultado = "📊 **RESULTADO DO QUERIDÔMETRO (ANÔNIMO)** 📊\n\n";
  for (let id in PARTICIPANTES) {
    resultado += `**${PARTICIPANTES[id].toUpperCase()} RECEBEU:**\n`;
    let temVoto = false;
    for (let emoji in votosRecebidos[id]) {
      if (votosRecebidos[id][emoji] > 0) {
        resultado += `${emoji} x${votosRecebidos[id][emoji]}  `;
        temVoto = true;
      }
    }
    if (!temVoto) resultado += "Nenhum emoji recebido.";
    resultado += "\n\n";
  }
  canal.send(resultado);
}

async function enviarPergunta(user, index, lista) {
  if (index >= lista.length) {
    jaVotou.add(user.id);
    user.send("✅ Votação finalizada.");
    return;
  }
  const alvoId = lista[index];
  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();
  EMOJIS.forEach((e, i) => {
    const btn = new ButtonBuilder()
      .setCustomId(`${alvoId}_${e}_${index}`)
      .setLabel(e)
      .setStyle(ButtonStyle.Secondary);
    if (i < 5) row1.addComponents(btn);
    else row2.addComponents(btn);
  });
  await user.send({
    content: `Vote para **${PARTICIPANTES[alvoId]}**`,
    components: [row1, row2]
  });
}

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  const [alvoId, emoji, index] = interaction.customId.split("_");
  const userId = interaction.user.id;
  if (!votosRecebidos[alvoId]) {
    votosRecebidos[alvoId] = {};
    EMOJIS.forEach(e => votosRecebidos[alvoId][e] = 0);
  }
  votosRecebidos[alvoId][emoji]++;
  await interaction.reply({ content: `Você marcou ${emoji}`, ephemeral: true });
  const outros = Object.keys(PARTICIPANTES).filter(id => id !== userId);
  enviarPergunta(interaction.user, parseInt(index) + 1, outros);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content === "!setcanal") {
    canalId = message.channel.id;
    message.reply("✅ Canal configurado.");
  }
  if (message.content === "!abrir") {
    resetarVotacao();
    message.channel.send("@here 🟢 **VOTAÇÃO ABERTA!** Usem `!votar` para participar.");
  }
  if (message.content === "!votar") {
    if (!votacaoAberta) return message.reply("⏳ Votação fechada.");
    if (!PARTICIPANTES[message.author.id]) return message.reply("❌ Não autorizado.");
    if (jaVotou.has(message.author.id)) return message.reply("⚠️ Já votou.");
    const outros = Object.keys(PARTICIPANTES).filter(id => id !== message.author.id);
    enviarPergunta(message.author, 0, outros);
    message.reply("📩 Te chamei no privado!");
  }
  if (message.content === "!forcarresultado") {
    enviarResultado(message.channel);
    votacaoAberta = false;
  }
});

cron.schedule("0 12 * * *", async () => {
  if (!canalId) return;
  resetarVotacao();
  const canal = await client.channels.fetch(canalId);
  if (canal) {
    canal.send("@here 🟢 **VOTAÇÃO ABERTA!** Usem `!votar` para participar.");
  }
}, { timezone: "America/Sao_Paulo" });

client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

client.login(TOKEN_DO_BOT);
