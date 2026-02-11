const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const TOKEN_DO_BOT = "MTQ3MDkxMjc4MDgxODE4NjI3MQ.GQOdaj.0seTj8J1RDx_ssnPv1eivQf8zFlhPfreeeO99Y";

const CONFIG_PATH = path.join(__dirname, "config.json");
const STATE_PATH = path.join(__dirname, "state.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function dayKey(timezone) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(x => x.type === "year").value;
  const m = parts.find(x => x.type === "month").value;
  const d = parts.find(x => x.type === "day").value;
  return `${y}-${m}-${d}`;
}

function ensureState(cfg, st) {
  const today = dayKey(cfg.timezone);

  if (st.dayKey !== today) {
    st.dayKey = today;
    st.isOpen = false;
    st.perVoter = {};
    st.completedVoters = [];
    st.votesTotals = {};

    for (const p of cfg.participants) {
      st.votesTotals[p.id] = {};
      for (const e of cfg.emojis) st.votesTotals[p.id][e] = 0;
    }
  }

  for (const p of cfg.participants) {
    if (!st.votesTotals[p.id]) {
      st.votesTotals[p.id] = {};
      for (const e of cfg.emojis) st.votesTotals[p.id][e] = 0;
    }
  }

  return st;
}

function isAdmin(message) {
  return message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
}

const sessions = new Map();

function nextIndexSkippingSelf(cfg, voterId, startIdx) {
  for (let i = startIdx; i < cfg.participants.length; i++) {
    if (cfg.participants[i].id !== voterId) return i;
  }
  return -1;
}

function buildEmojiRow(cfg, participantId) {
  const row = new ActionRowBuilder();
  for (let i = 0; i < cfg.emojis.length; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote:${participantId}:${i}`)
        .setLabel(cfg.emojis[i])
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return row;
}

function getLabelById(cfg, id) {
  return cfg.participants.find(p => p.id === id)?.label || id;
}

async function sendNextStep(user, cfg) {
  const s = sessions.get(user.id);
  if (!s) return;

  const idx = s.idx;

  if (idx < 0 || idx >= cfg.participants.length) {
    sessions.delete(user.id);
    await user.send("✅ **Votação finalizada!**");
    return;
  }

  const participant = cfg.participants[idx];
  await user.send({
    content: `🗳️ **Vote em:** **${participant.label}**\nEscolha um emoji:`,
    components: [buildEmojiRow(cfg, participant.id)]
  });
}

async function buildResultsText(cfg, st, guild) {
  let txt = "📊 **RESULTADO DO QUERIDÔMETRO** 📊\n\n";

  for (const p of cfg.participants) {
    txt += `**${p.label.toUpperCase()}**\n`;
    for (const e of cfg.emojis) {
      txt += `${e} → ${st.votesTotals[p.id]?.[e] ?? 0}\n`;
    }
    txt += "\n";
  }

  txt += "🧾 **VOTOS POR PESSOA**\n";
  txt += "(mostra o que cada um marcou)\n\n";

  const voterIds = Object.keys(st.perVoter);
  for (const voterId of voterIds) {
    let display = `<@${voterId}>`;
    try {
      const m = await guild.members.fetch(voterId);
      display = m.displayName || m.user.username || display;
    } catch {}

    txt += `**${display}**\n`;

    for (const p of cfg.participants) {
      if (p.id === voterId) continue;
      const chosen = st.perVoter[voterId]?.[p.id] ?? "—";
      txt += `${p.label}: ${chosen}\n`;
    }

    txt += "\n";
  }

  return txt;
}

async function postResults(cfg, st, guild, forced = false) {
  if (!cfg.channelId) return;
  const ch = await guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!ch) return;

  const msg = await buildResultsText(cfg, st, guild);
  await ch.send(forced ? `⚠️ **RESULTADO FORÇADO (admin)**\n\n${msg}` : msg);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);

  const cfg = readJson(CONFIG_PATH);

  cron.schedule(
    `0 ${cfg.openHour} * * *`,
    async () => {
      const config = readJson(CONFIG_PATH);
      let state = readJson(STATE_PATH);
      state = ensureState(config, state);

      if (state.isOpen) return;
      if (!config.guildId || !config.channelId) return;

      state.isOpen = true;
      writeJson(STATE_PATH, state);

      const guild = await client.guilds.fetch(config.guildId).catch(() => null);
      if (!guild) return;

      const ch = await guild.channels.fetch(config.channelId).catch(() => null);
      if (!ch) return;

      await ch.send(
        "💗 **QUERIDÔMETRO ABERTO** 💗\n\n" +
        "Votantes autorizados: digitem `!votar`.\n"
      );
    },
    { timezone: cfg.timezone }
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.type === ChannelType.DM) return;

  const cfg = readJson(CONFIG_PATH);
  let st = readJson(STATE_PATH);
  st = ensureState(cfg, st);
  writeJson(STATE_PATH, st);

  const content = message.content.trim();

  if (content === "!setcanal") {
    if (!isAdmin(message)) return message.reply("❌ Só admin.");

    cfg.guildId = message.guild.id;
    cfg.channelId = message.channel.id;
    writeJson(CONFIG_PATH, cfg);

    return message.reply("✅ Canal configurado (avisos e resultados).");
  }

  if (content === "!abrir") {
    if (!isAdmin(message)) return message.reply("❌ Só admin.");

    st.isOpen = true;
    writeJson(STATE_PATH, st);

    return message.channel.send("🟢 **Votação aberta!** Votantes autorizados usem `!votar`.");
  }

  if (content === "!fechar") {
    if (!isAdmin(message)) return message.reply("❌ Só admin.");
    st.isOpen = false;
    writeJson(STATE_PATH, st);
    return message.channel.send("🏁 **Votação fechada.**");
  }

  if (content === "!forcarresultado") {
    if (!isAdmin(message)) return message.reply("❌ Só admin.");
    await postResults(cfg, st, message.guild, true);
    return message.reply("✅ Resultado enviado.");
  }

  if (content === "!votar") {
    if (!st.isOpen) return message.reply("⏳ Votação fechada.");

    if (!cfg.allowedVoters.includes(message.author.id)) {
      return message.reply("❌ Você não está autorizado a votar.");
    }

    if (st.completedVoters.includes(message.author.id)) {
      return message.reply("⚠️ Você já votou hoje.");
    }

    if (!st.perVoter[message.author.id]) st.perVoter[message.author.id] = {};
    writeJson(STATE_PATH, st);

    const firstIdx = nextIndexSkippingSelf(cfg, message.author.id, 0);
    if (firstIdx === -1) return message.reply("⚠️ Não há ninguém para você votar.");

    sessions.set(message.author.id, { guildId: message.guild.id, idx: firstIdx });

    try {
      await message.author.send("💗 **Vamos votar!** (um por vez)");
      await sendNextStep(message.author, cfg);
      return message.reply("📩 Te chamei no privado!");
    } catch {
      sessions.delete(message.author.id);
      return message.reply("❌ Não consegui te mandar DM. Ative suas DMs do servidor.");
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const cfg = readJson(CONFIG_PATH);
  let st = readJson(STATE_PATH);
  st = ensureState(cfg, st);

  const userId = interaction.user.id;
  const session = sessions.get(userId);

  if (!session) {
    return interaction.reply({ content: "⚠️ Sem votação ativa. Use `!votar` no canal.", ephemeral: true });
  }

  if (!st.isOpen) {
    sessions.delete(userId);
    return interaction.reply({ content: "⏳ Votação fechada.", ephemeral: true });
  }

  const [_, participantId, emojiIndexStr] = interaction.customId.split(":");
  const emojiIndex = Number(emojiIndexStr);
  const emoji = cfg.emojis[emojiIndex];

  if (!emoji) return interaction.reply({ content: "❌ Emoji inválido.", ephemeral: true });
  if (!cfg.allowedVoters.includes(userId)) return interaction.reply({ content: "❌ Você não está autorizado.", ephemeral: true });
  if (participantId === userId) return interaction.reply({ content: "❌ Você não vota em si mesmo.", ephemeral: true });

  if (!st.perVoter[userId]) st.perVoter[userId] = {};
  st.perVoter[userId][participantId] = emoji;

  if (!st.votesTotals[participantId]) {
    st.votesTotals[participantId] = {};
    for (const e of cfg.emojis) st.votesTotals[participantId][e] = 0;
  }
  st.votesTotals[participantId][emoji] += 1;

  writeJson(STATE_PATH, st);

  await interaction.update({
    content: `✅ Marcado em **${getLabelById(cfg, participantId)}**: ${emoji}`,
    components: []
  });

  const nextIdx = nextIndexSkippingSelf(cfg, userId, session.idx + 1);

  if (nextIdx === -1) {
    if (!st.completedVoters.includes(userId)) st.completedVoters.push(userId);
    writeJson(STATE_PATH, st);
    sessions.delete(userId);

    await interaction.followUp({ content: "🎉 Você terminou a votação!", ephemeral: true });

    const totalPermitidos = cfg.allowedVoters.length;
    const totalConcluidos = st.completedVoters.filter(id => cfg.allowedVoters.includes(id)).length;

    if (totalPermitidos > 0 && totalConcluidos >= totalPermitidos) {
      const guild = await client.guilds.fetch(session.guildId).catch(() => null);
      if (guild) await postResults(cfg, st, guild, false);

      st.isOpen = false;
      writeJson(STATE_PATH, st);
    }

    return;
  }

  session.idx = nextIdx;
  sessions.set(userId, session);

  await sendNextStep(interaction.user, cfg);
});

client.login(TOKEN_DO_BOT);
