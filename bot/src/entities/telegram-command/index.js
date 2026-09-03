function parseTelegramCommand(text, botUsername) {
  const trimmed = String(text || "").trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const [commandName, commandBot] = rawCommand.split("@");

  if (commandBot && commandBot.toLowerCase() !== String(botUsername || "").toLowerCase()) {
    return null;
  }

  return {
    command: commandName,
    payload: rest.join(" ").trim(),
  };
}

module.exports = {
  parseTelegramCommand,
};
