type ContractGradientPalette = {
  backgroundColor: string;
  colors: [string, string, string, string];
};

const palettes: ContractGradientPalette[] = [
  { backgroundColor: "#07151d", colors: ["#22d3ee", "#2563eb", "#8b5cf6", "#34d399"] },
  { backgroundColor: "#160c24", colors: ["#f472b6", "#8b5cf6", "#3b82f6", "#fb7185"] },
  { backgroundColor: "#10170c", colors: ["#a3e635", "#10b981", "#06b6d4", "#facc15"] },
  { backgroundColor: "#1c0e0b", colors: ["#fb923c", "#ef4444", "#a855f7", "#facc15"] },
  { backgroundColor: "#071a19", colors: ["#2dd4bf", "#0ea5e9", "#6366f1", "#84cc16"] },
];

const hashSeed = (seed: string) => {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const getContractGradientStyle = (seed: string) => {
  const hash = hashSeed(seed || "favor");
  const palette = palettes[hash % palettes.length];
  const shift = hash % 17;

  return {
    backgroundColor: palette.backgroundColor,
    backgroundImage: [
      `radial-gradient(circle at ${18 + shift}% ${16 + (shift % 9)}%, ${palette.colors[0]} 0%, transparent 38%)`,
      `radial-gradient(circle at ${82 - (shift % 11)}% ${22 + shift}%, ${palette.colors[1]} 0%, transparent 42%)`,
      `radial-gradient(circle at ${72 + (shift % 9)}% ${84 - (shift % 13)}%, ${palette.colors[2]} 0%, transparent 44%)`,
      `radial-gradient(circle at ${20 + (shift % 13)}% ${78 - (shift % 7)}%, ${palette.colors[3]} 0%, transparent 40%)`,
      `linear-gradient(${125 + (hash % 55)}deg, ${palette.backgroundColor} 5%, #09090b 96%)`,
    ].join(", "),
  };
};
