export const TELEGRAM_SCREEN_LAYOUT = {
  height: 720,
  width: 360,
  statusBarHeight: 48,
  headerHeight: 72,
  chatBodyHeight: 538,
  composerHeight: 62,
} as const;

export const TELEGRAM_SCREEN_THEME = {
  surface: "#0b0c10",
  statusBar: "#0d0e12",
  header: "#15161c",
  divider: "rgba(255,255,255,0.1)",
  incoming: "#292a31",
  outgoingStart: "#2821aa",
  outgoingEnd: "#4a36df",
  accent: "#8b7dff",
  muted: "#71717a",
  composerInput: "#26272e",
  composerSend: "#3035ed",
} as const;
