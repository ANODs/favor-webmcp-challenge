import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { collectTelegramScouting } from "./collector";
import { parseScoutingInput, resolveDateWindow } from "./helpers";

type CliOptions = {
  input: string;
  output: string;
  from?: string;
  to?: string;
  days?: number;
};

const HELP = `Favor Telegram scouting collector (dry-run only)

Usage:
  pnpm scout:telegram -- --input <channels.json> --output <artifact.json> [--days 30]
  pnpm scout:telegram -- --input <channels.json> --output <artifact.json> --from 2026-07-01 --to 2026-07-31

Options:
  --input   Local JSON channel configuration (required)
  --output  Local JSON artifact path (required)
  --days    Rolling window in days; defaults to 30
  --from    Inclusive ISO date/time or YYYY-MM-DD
  --to      Inclusive ISO date/time or YYYY-MM-DD
  --help    Show this help

This command only reads public t.me/s pages and writes a dry-run JSON artifact.
It has no code path for contract creation or message sending.`;

const readValue = (args: string[], index: number, option: string) => {
  const current = args[index];
  const inline = current.match(new RegExp(`^${option}=(.+)$`));
  if (inline) return { value: inline[1], consumed: 0 };
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return { value, consumed: 1 };
};

export const parseCliArgs = (args: string[]): CliOptions | { help: true } => {
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  const dangerous = args.find((arg) =>
    /^(?:--publish|--send|--message|--create-contracts?)(?:=|$)/i.test(arg),
  );
  if (dangerous) {
    throw new Error(`${dangerous} is intentionally unsupported; this collector is dry-run only.`);
  }

  const options: Partial<CliOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const option = arg.split("=", 1)[0];
    if (!["--input", "--output", "--from", "--to", "--days"].includes(option)) {
      throw new Error(`Unknown option: ${arg}`);
    }
    const { value, consumed } = readValue(args, index, option);
    index += consumed;
    if (option === "--input") options.input = value;
    if (option === "--output") options.output = value;
    if (option === "--from") options.from = value;
    if (option === "--to") options.to = value;
    if (option === "--days") {
      const days = Number(value);
      if (!Number.isInteger(days)) throw new Error("--days must be an integer.");
      options.days = days;
    }
  }

  if (!options.input) throw new Error("--input is required.");
  if (!options.output) throw new Error("--output is required.");
  return options as CliOptions;
};

export const runCli = async (args: string[]) => {
  const cli = parseCliArgs(args);
  if ("help" in cli) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const inputPath = path.resolve(cli.input);
  const outputPath = path.resolve(cli.output);
  if (inputPath === outputPath) {
    throw new Error("--input and --output must point to different files.");
  }
  const config = parseScoutingInput(JSON.parse(await readFile(inputPath, "utf8")));
  const window = resolveDateWindow({ from: cli.from, to: cli.to, days: cli.days });
  const artifact = await collectTelegramScouting({
    ...config,
    ...window,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
};

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
