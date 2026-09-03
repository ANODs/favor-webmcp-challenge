import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import englishMessages from "../../src/shared/locales/en.json";
import russianMessages from "../../src/shared/locales/ru.json";

type MessageTree = string | { [key: string]: MessageTree };

const flattenMessages = (
  value: MessageTree,
  prefix = "",
  result = new Map<string, string>(),
) => {
  if (typeof value === "string") {
    result.set(prefix, value);
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    flattenMessages(child, prefix ? `${prefix}.${key}` : key, result);
  }

  return result;
};

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [entryPath] : [];
  });

test("English and Russian locale catalogs expose the same complete key set", () => {
  const english = flattenMessages(englishMessages as MessageTree);
  const russian = flattenMessages(russianMessages as MessageTree);

  assert.deepEqual([...english.keys()].sort(), [...russian.keys()].sort());

  for (const [key, value] of english) {
    assert.ok(value.trim(), `English message ${key} is empty`);
    assert.ok(russian.get(key)?.trim(), `Russian message ${key} is empty`);
  }
});

test("runtime TypeScript source contains no hardcoded Cyrillic copy", () => {
  const sourceRoot = path.resolve(process.cwd(), "src");
  const offenders = collectSourceFiles(sourceRoot).flatMap((filePath) => {
    const relativePath = path
      .relative(sourceRoot, filePath)
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
    `Move localized copy and linguistic data to JSON catalogs:\n${offenders.join("\n")}`,
  );
});
