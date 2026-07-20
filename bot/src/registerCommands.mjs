#!/usr/bin/env node
// bot/src/registerCommands.mjs
// Registra /opina como comando de servidor (guild) -- instantáneo, a
// diferencia de un comando global (tarda ~1h en propagarse). Ejecutar una vez
// tras desplegar, o cada vez que cambie la definición del comando.
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config.mjs";

const commands = [
  new SlashCommandBuilder()
    .setName("opina")
    .setDescription("Comparte tu opinión sobre una propuesta de Razón Común -- la IA la clasifica y la registra.")
    .addStringOption((opt) =>
      opt.setName("texto").setDescription("Tu opinión, en tus propias palabras").setRequired(true)
    ),
].map((c) => c.toJSON());

async function main() {
  if (!config.discordToken || !config.clientId || !config.guildId) {
    console.error("Faltan DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID -- pendiente de Sergio.");
    process.exit(1);
  }
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log("Comando /opina registrado en el servidor.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
