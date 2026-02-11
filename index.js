const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const CANAL_RESULTADO_ID = "1470925141927264338";

const PARTICIPANTES = {
  "550493155565240321": "Khloe",
  "231466178600632320": "Fernanda",
  "527485966420803604": "Kehlani",
  "481435037200416779": "Hinata",
  "1183812356795531404": "Mia",
  "285603510660366347": "Priska"
};

const VOTANTES = Object.keys(PARTICIPANTES);

const EMOJIS = ["❤️","🌼","💣","🍪","🐍","🤮","💼","🤥","💔"];

let votos = {};
let votou = new Set();
let filaVotacao = {};
let votacaoAberta = false;

function resetarVotacao() {
  votos = {};
  votou.clear();
  votacaoAberta = true;

  for (const id in PARTICIPANTES) {
    votos[id] = {};
    EMOJIS.forEach(e => votos[id][e] = 0);
  }
}

async function enviarResultado(guild) {
  const canal = guild.channels.cache.get(CANAL_RESULTADO_ID);
  if (!canal) return;

  let texto = "📊 **RESULTADO DO QUERIDÔMETRO** 📊\n\n";

  for (const id in votos) {
    texto += `**${PARTICIPANTES[id]}**\n`;
    for (const emoji in votos[id]) {
      texto += `${emoji} → ${votos[id][emoji]}\n`;
    }
    txt += "\n";
  }

  canal.send(texto);
}

client.once("ready", () => {
  console.log(`🤖 Online como ${client.user.tag}`);
  resetarVotacao();

  setInterval(() => {
    const agora = new Date();
    if (agora.getHours() === 12 && agora.getMinutes() === 0) {
      resetarVotacao();
    }
  }, 60000);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content === "!forcarresultado") {
    if (!msg.member?.permissions.has("Administrator")) return;
    await enviarResultado(msg.guild);
    votacaoAberta = false;
    return;
  }

  if (msg.content === "!votar") {
    if (!votacaoAberta) return msg.reply("⛔ Votação fechada.");
    if (!VOTANTES.includes(msg.author.id)) return msg.reply("❌ Você não pode votar.");
    if (votou.has(msg.author.id)) return msg.reply("⚠️ Você já votou hoje.");

    filaVotacao[msg.author.id] = Object.keys(PARTICIPANTES)
      .filter(id => id !== msg.author.id);

    msg.reply("📩 Te chamei no privado!");
    enviarProximo(msg.author);
  }
});

async function enviarProximo(user) {
  const fila = filaVotacao[user.id];
  if (!fila || fila.length === 0) {
    votou.add(user.id);
    user.send("✅ Voto finalizado!");

    if (votou.size === VOTANTES.length) {
      enviarResultado(client.guilds.cache.first());
      votacaoAberta = false;
    }
    return;
  }

  const alvoId = fila[0];
  const nome = PARTICIPANTES[alvoId];

  const row = new ActionRowBuilder();
  EMOJIS.forEach(e => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`voto_${alvoId}_${e}`)
        .setLabel(e)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  user.send({
    content: `Vote para **${nome}**`,
    components: [row]
  });
}

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const [_, alvo, emoji] = i.customId.split("_");
  votos[alvo][emoji]++;
  filaVotacao[i.user.id].shift();

  await i.update({ content: "✅ Registrado", components: [] });
  enviarProximo(i.user);
});

client.login(process.env.TOKEN);
