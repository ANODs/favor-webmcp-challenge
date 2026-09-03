import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer";

const DEFAULT_URL = "http://localhost:3000/ru?workflowCapture=1";
const DEFAULT_OUTPUT_DIR = "output/workflow-showcase-capture";
const DEFAULT_PROGRESS_POINTS = [0.08, 0.29, 0.5, 0.71, 0.92];
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const USAGE = `Capture deterministic Favor workflow showcase frames.

Usage:
  node scripts/capture-workflow-showcase.mjs [local-url] [options]

Options:
  --url <url>          Local page URL (default: ${DEFAULT_URL})
  --output <path>      Screenshot directory (default: ${DEFAULT_OUTPUT_DIR})
  --progress <values>  Comma-separated normalized values from 0 to 1
  --width <pixels>     Viewport width (default: 1440)
  --height <pixels>    Viewport height (default: 900)
  --timeout <ms>       Navigation and readiness timeout (default: 30000)

The same options can be supplied with WORKFLOW_CAPTURE_URL,
WORKFLOW_CAPTURE_OUTPUT, WORKFLOW_CAPTURE_PROGRESS, WORKFLOW_CAPTURE_WIDTH,
WORKFLOW_CAPTURE_HEIGHT, and WORKFLOW_CAPTURE_TIMEOUT.`;

function readOption(name) {
  const exactIndex = process.argv.indexOf(`--${name}`);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];

  const prefix = `--${name}=`;
  const option = process.argv.find((argument) => argument.startsWith(prefix));
  return option?.slice(prefix.length);
}

function readPositiveInteger(value, fallback, optionName) {
  if (value === undefined) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer, received: ${value}`);
  }

  return parsed;
}

function readProgressPoints(value) {
  if (!value) return DEFAULT_PROGRESS_POINTS;

  const points = value.split(",").map((item) => Number(item.trim()));
  if (
    points.length === 0 ||
    points.some((point) => !Number.isFinite(point) || point < 0 || point > 1)
  ) {
    throw new Error(
      `progress must be a comma-separated list of normalized values from 0 to 1, received: ${value}`,
    );
  }

  return points;
}

function getCaptureUrl(value) {
  const url = new URL(value ?? DEFAULT_URL);
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new Error(
      `Capture is local-only. Expected localhost, 127.0.0.1, or ::1; received: ${url.hostname}`,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Capture URL must use HTTP or HTTPS, received: ${url.protocol}`);
  }

  url.searchParams.set("workflowCapture", "1");
  return url.toString();
}

function getFrameName(index, progress) {
  const progressLabel = Math.round(progress * 1000).toString().padStart(4, "0");
  return `frame-${String(index + 1).padStart(2, "0")}-p${progressLabel}.png`;
}

async function waitForCaptureApi(page, timeout) {
  await page.waitForFunction(
    () => {
      const api = window.__favorWorkflow;
      return Boolean(
        api &&
          api.ready instanceof Promise &&
          typeof api.setProgress === "function" &&
          typeof api.whenRendered === "function",
      );
    },
    { timeout },
  );

  await page.evaluate(async () => {
    await Promise.all([window.__favorWorkflow.ready, document.fonts.ready]);
  });
}

async function capture() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const firstArgument = process.argv[2];
  const positionalUrl = firstArgument?.startsWith("http") ? firstArgument : undefined;
  const captureUrl = getCaptureUrl(
    readOption("url") ?? process.env.WORKFLOW_CAPTURE_URL ?? positionalUrl,
  );
  const outputDir = path.resolve(
    process.cwd(),
    readOption("output") ??
      process.env.WORKFLOW_CAPTURE_OUTPUT ??
      DEFAULT_OUTPUT_DIR,
  );
  const width = readPositiveInteger(
    readOption("width") ?? process.env.WORKFLOW_CAPTURE_WIDTH,
    1440,
    "width",
  );
  const height = readPositiveInteger(
    readOption("height") ?? process.env.WORKFLOW_CAPTURE_HEIGHT,
    900,
    "height",
  );
  const timeout = readPositiveInteger(
    readOption("timeout") ?? process.env.WORKFLOW_CAPTURE_TIMEOUT,
    30_000,
    "timeout",
  );
  const progressPoints = readProgressPoints(
    readOption("progress") ?? process.env.WORKFLOW_CAPTURE_PROGRESS,
  );

  await mkdir(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--use-angle=swiftshader",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(captureUrl, { waitUntil: "networkidle2", timeout });
    await waitForCaptureApi(page, timeout);
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });

    const section = await page.waitForSelector(
      '#favor-workflow[data-workflow-capture="true"]',
      { timeout },
    );
    if (!section) throw new Error("Workflow capture section was not found");

    await section.evaluate((element) =>
      element.scrollIntoView({ block: "start", inline: "nearest" }),
    );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    for (const [index, progress] of progressPoints.entries()) {
      await page.evaluate(async (nextProgress) => {
        window.__favorWorkflow.setProgress(nextProgress);
        await window.__favorWorkflow.whenRendered();
      }, progress);

      const fileName = getFrameName(index, progress);
      const filePath = path.join(outputDir, fileName);
      await section.screenshot({ path: filePath, type: "png" });
      process.stdout.write(`${filePath}\n`);
    }
  } finally {
    await browser.close();
  }
}

capture().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
