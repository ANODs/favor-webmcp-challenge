import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateBuildMetadata,
  resolveCommitSha,
} from "../../scripts/generate-build-metadata.mjs";

const createTestDirectory = async (t: test.TestContext) => {
  const directory = await mkdtemp(path.join(tmpdir(), "favor-build-metadata-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
};

test("uses APP_COMMIT_SHA when CI supplies it", async () => {
  const commitSha = "a".repeat(40);

  assert.equal(
    await resolveCommitSha({
      environment: { ...process.env, APP_COMMIT_SHA: commitSha.toUpperCase() },
    }),
    commitSha,
  );
});

test("resolves a detached HEAD", async (t) => {
  const directory = await createTestDirectory(t);
  const commitSha = "b".repeat(40);

  await mkdir(path.join(directory, ".git"));
  await writeFile(path.join(directory, ".git", "HEAD"), `${commitSha}\n`);

  assert.equal(await resolveCommitSha({ workingDirectory: directory }), commitSha);
});

test("resolves a symbolic HEAD from a loose ref", async (t) => {
  const directory = await createTestDirectory(t);
  const commitSha = "c".repeat(40);
  const headsDirectory = path.join(directory, ".git", "refs", "heads");

  await mkdir(headsDirectory, { recursive: true });
  await writeFile(path.join(directory, ".git", "HEAD"), "ref: refs/heads/master\n");
  await writeFile(path.join(headsDirectory, "master"), `${commitSha}\n`);

  assert.equal(await resolveCommitSha({ workingDirectory: directory }), commitSha);
});

test("resolves a symbolic HEAD from packed refs", async (t) => {
  const directory = await createTestDirectory(t);
  const commitSha = "d".repeat(40);
  const gitDirectory = path.join(directory, ".git");

  await mkdir(gitDirectory);
  await writeFile(path.join(gitDirectory, "HEAD"), "ref: refs/heads/master\n");
  await writeFile(
    path.join(gitDirectory, "packed-refs"),
    `# pack-refs with: peeled fully-peeled\n${commitSha} refs/heads/master\n`,
  );

  assert.equal(await resolveCommitSha({ workingDirectory: directory }), commitSha);
});

test("writes build metadata without other Git data", async (t) => {
  const directory = await createTestDirectory(t);
  const commitSha = "e".repeat(40);
  const outputPath = path.join(directory, "metadata.json");

  const metadata = await generateBuildMetadata({
    environment: { ...process.env, APP_COMMIT_SHA: commitSha },
    outputPath,
    workingDirectory: directory,
  });

  assert.deepEqual(metadata, { commitSha });
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), { commitSha });
});
