const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require("discord.js");

const cron = require("node-cron");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
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

const EMOJIS = ["❤","🌼","💣","🍪","🐍","🤮","💼","🤥","💔"];

let votacaoAberta = false;
let votos = {};
let votosFeitos = new Set();

function iniciarVotacao() {
  votacaoAberta = true;
  votos = {};
  votosFeitos.clear();

  for (const id in PARTICIPANTES) {
    votos[id] = {};
    EMOJIS.forEach(e => votos[id][e] = 0);
  }

  const canal = client.channels.cache.get(CANAL_RESULTADO_ID);
  if (canal) canal.send("🟢 **QUERIDÔMETRO ABERTO!** Vote por DM usando `!votar`");
}

function encerrarVotacao() {
  votacaoAberta = false;
  const canal = client.channels.cache.get(CANAL_RESULTADO_ID);

  let texto = "📊 **RESULTADO DO QUERIDÔMETRO**\n\n";

  for (const id in votos) {
    texto += `**${PARTICIPANTES[id]}**\n`;
    for (const emoji in votos[id]) {
      texto += `${emoji} → ${votos[id][emoji]}\n`;
    }
    texto += "\n";
  }

  if (canal) canal.send(texto);
}

cron.schedule("0 12 * * *", () => {
  iniciarVotacao();
}, { timezone: "America/Sao_Paulo" });

client.on("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!forcarresultado") {
    encerrarVotacao();
  }

  if (message.content === "!votar") {
    if (!votacaoAberta) return message.reply("⛔ Votação fechada.");
    if (!PARTICIPANTES[message.author.id]) return message.reply("⛔ Você não pode votar.");
    if (votosFeitos.has(message.author.id)) return message.reply("⛔ Você já votou hoje.");

    const participantes = Object.keys(PARTICIPANTES).filter(id => id !== message.author.id);
    let index = 0;

    const enviar = async () => {
      const alvoId = participantes[index];
      const row = new ActionRowBuilder();

      EMOJIS.forEach(e => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`${alvoId}|${e}`)
            .setEmoji(e)
            .setStyle(ButtonStyle.Secondary)
        );
      });

      await message.author.send({
        content: `Vote em **${PARTICIPANTES[alvoId]}**`,
        components: [row]
      });
    };

    await enviar();

    client.on("interactionCreate", async (i) => {
      if (!i.isButton()) return;
      if (i.user.id !== message.author.id) return;

      const [alvo, emoji] = i.customId.split("|");
      votos[alvo][emoji]++;
      index++;

      if (index >= participantes.length) {
        votosFeitos.add(i.user.id);
        await i.update({ content: "✅ Voto finalizado!", components: [] });

        if (votosFeitos.size === Object.keys(PARTICIPANTES).length) {
          encerrarVotacao();
        }
      } else {
        await i.update({ content: `Vote em **${PARTICIPANTES[participantes[index]]}**`, components: i.message.components });
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
