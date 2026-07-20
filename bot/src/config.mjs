// bot/src/config.mjs
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}. Copia bot/.env.example a .env (pendiente de Sergio: token de Discord).`);
  return v;
}

export const config = {
  discordToken: process.env.DISCORD_BOT_TOKEN || "",
  clientId: process.env.DISCORD_CLIENT_ID || "",
  guildId: process.env.DISCORD_GUILD_ID || "",
  brainServiceUrl: (process.env.BRAIN_SERVICE_URL || "http://brain-service:8787").replace(/\/+$/, ""),
  brainInternalToken: process.env.BRAIN_INTERNAL_TOKEN || "",
  teamChannelIds: (process.env.DISCORD_TEAM_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export function assertReady() {
  required("DISCORD_BOT_TOKEN");
  if (!config.brainInternalToken) {
    throw new Error("Falta BRAIN_INTERNAL_TOKEN -- rc-brain-service rechazará todas las peticiones del bot (fail-closed).");
  }
}
