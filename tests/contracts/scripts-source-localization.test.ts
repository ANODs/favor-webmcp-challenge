import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const collectRuntimeSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectRuntimeSourceFiles(entryPath);
    }

    return entry.isFile() && /\.(?:[cm]?[jt]sx?)$/u.test(entry.name)
      ? [entryPath]
      : [];
  });

test("runtime scripts contain no embedded Cyrillic copy or linguistic data", () => {
  const scriptsRoot = path.resolve(process.cwd(), "scripts");
  const offenders = collectRuntimeSourceFiles(scriptsRoot).flatMap((filePath) => {
    const relativePath = path
      .relative(scriptsRoot, filePath)
      .split(path.sep)
      .join("/");
    const source = readFileSync(filePath, "utf8");

    return source
      .split(/\r?\n/u)
      .flatMap((line, index) =>
        /[\u0400-\u04ff]/u.test(line)
          ? [`${relativePath}:${index + 1}`]
          : [],
      );
  });

  assert.deepEqual(
    offenders,
    [],
    `Move localized copy and linguistic data to script-owned JSON catalogs:\n${offenders.join("\n")}`,
  );
});
