#!/usr/bin/env node
// bot/src/index.mjs
//
// Bot de Discord del RC-Brain (fase 1 de docs/tecnico/rc-brain.md, "cero
// interfaz que construir; el equipo ya vive en Discord"). Dos capacidades:
//
//   1. Mención (@RC-Brain ¿qué dice el punto 17?) en el canal del equipo ->
//      /chat-team de rc-brain-service (corpus completo, público + interno).
//   2. /opina texto:"..." -> clasificación directa vía /classify-opinion
//      (docs/tecnico/chatbot-opina.md). Simplificado a un único turno: la
//      entrevista completa de 1-2 repreguntas vive en el widget web (rc-08 no
//      tuvo presupuesto en esta ola para replicar el estado de conversación
//      multi-turno en un hilo de Discord -- ver informe final).
//
// NO VERIFICADO EN EJECUCIÓN: requiere DISCORD_BOT_TOKEN (pendiente de
// Sergio). El código está completo y sigue el mismo patrón de fail-closed que
// el resto del servicio (sin BRAIN_INTERNAL_TOKEN, no arranca).

import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import { config, assertReady } from "./config.mjs";
import { askTeamChat, classifyOpinion } from "./brainClient.mjs";

assertReady();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`RC-Brain bot conectado como ${c.user.tag}.`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!client.user || !message.mentions.has(client.user)) return;
  if (config.teamChannelIds.length > 0 && !config.teamChannelIds.includes(message.channelId)) return;

  const question = message.content.replace(/<@!?\d+>/g, "").trim();
  if (!question) return;

  await message.channel.sendTyping();
  try {
    const result = await askTeamChat(question, `discord-${message.channelId}`);
    const fuentes = (result.sources || []).map((s, i) => `[${i + 1}] ${s.label}${s.visibility === "internal" ? " (interno)" : ""}`).join("\n");
    const texto = fuentes ? `${result.answer}\n\n**Fuentes:**\n${fuentes}` : result.answer;
    await message.reply(texto.slice(0, 1900)); // límite de Discord ~2000 chars
  } catch (err) {
    await message.reply(`No he podido responder: ${err.message}`);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "opina") return;

  const texto = interaction.options.getString("texto", true);
  await interaction.deferReply({ ephemeral: false });
  try {
    const result = await classifyOpinion({ rawText: texto, userId: interaction.user.id });
    const o = result.opinion;
    const puntos = o.points?.length ? `punto(s) ${o.points.join(", ")}` : "fuera del programa actual";
    await interaction.editReply(
      `Gracias, registrado sobre ${puntos} (postura: ${o.stance}, tipo: ${o.kind}). ` +
        `Cada mes publicamos qué cambió gracias a estas opiniones.`
    );
  } catch (err) {
    await interaction.editReply(`No he podido registrar tu opinión: ${err.message}`);
  }
});

client.login(config.discordToken);
