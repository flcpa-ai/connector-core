import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOnlyProblems, scannedFileCount } from "../src/guard.ts";

/** Build a throwaway repo tree. Returns its root; the caller removes it. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "guard-"));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return root;
}

/** The QuickBooks connector's real guard settings, in miniature. */
function options(root: string) {
  return {
    root,
    dirs: ["app"],
    allowedHostFiles: ["app/lib/intuit/oauth.server.ts", "app/lib/intuit/client.server.ts"],
    hostPattern: /\b[a-z.-]*intuit\.com\b/i,
    clientFile: "app/lib/intuit/client.server.ts",
    clientInterface: "ReadOnlyClient",
    oauthFile: "app/lib/intuit/oauth.server.ts",
    writeMechanics: [
      { pattern: /operation\s*[=:]\s*["']?(update|delete|void|send)/i, label: "an update/delete operation" },
      { pattern: /["'`/]batch\b/, label: "the batch endpoint" },
    ],
  };
}

const goodClient = `
const BASE = "https://quickbooks.api.intuit.com";
export interface ReadOnlyClient {
  get<T>(path: string): Promise<T>;
}
export const client = { get: (p: string) => fetch(BASE + p, { method: "GET" }) };
`;

const goodOAuth = `
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
export const exchange = () => fetch(TOKEN_URL, { method: "POST" });
export const revoke = () => fetch(REVOKE_URL, { method: "POST" });
`;

function withFixture(files: Record<string, string>, assertions: (problems: string[]) => void) {
  const root = fixture(files);
  try {
    assertions(readOnlyProblems(options(root)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a sound read-only connector has no problems", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient,
      "app/lib/intuit/oauth.server.ts": goodOAuth,
      "app/routes/home.tsx": `export default function Home() { return null; }`,
    },
    (problems) => assert.deepEqual(problems, []),
  );
});

test("a route that reaches the platform directly is caught", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient,
      "app/lib/intuit/oauth.server.ts": goodOAuth,
      "app/routes/sneaky.tsx": `await fetch("https://quickbooks.api.intuit.com/v3/company/1/invoice");`,
    },
    (problems) => {
      assert.equal(problems.length, 1);
      assert.match(problems[0], /app\/routes\/sneaky\.tsx: references a platform host/);
    },
  );
});

test("a comment naming the platform is allowed, so modules can explain themselves", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient,
      "app/lib/intuit/oauth.server.ts": goodOAuth,
      "app/lib/notes.ts": `// Tokens come from oauth.platform.intuit.com; see the OAuth module.\nexport const x = 1;`,
    },
    (problems) => assert.deepEqual(problems, []),
  );
});

test("a POST from the read client is caught", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient + `\nexport const push = () => fetch(BASE, { method: "POST" });`,
      "app/lib/intuit/oauth.server.ts": goodOAuth,
    },
    (problems) => assert.match(problems.join("\n"), /read client sends POST\. It must be GET-only/),
  );
});

test("an OAuth POST to an unapproved endpoint is caught", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient,
      "app/lib/intuit/oauth.server.ts": goodOAuth + `\nconst OTHER = "x";\nexport const o = () => fetch(OTHER, { method: "POST" });`,
    },
    (problems) => assert.match(problems.join("\n"), /POSTs to OTHER/),
  );
});

test("platform write mechanics are caught anywhere", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient,
      "app/lib/intuit/oauth.server.ts": goodOAuth,
      "app/lib/cleanup.ts": `export const url = "/v3/company/1/invoice?operation=delete";`,
    },
    (problems) => assert.match(problems.join("\n"), /an update\/delete operation/),
  );
});

test("a client exposing more than get is caught", () => {
  withFixture(
    {
      "app/lib/intuit/client.server.ts": goodClient.replace(
        "get<T>(path: string): Promise<T>;",
        "get<T>(path: string): Promise<T>;\n  post<T>(path: string): Promise<T>;",
      ),
      "app/lib/intuit/oauth.server.ts": goodOAuth,
    },
    (problems) => assert.match(problems.join("\n"), /exposes \[get, post\]; it may only expose get/),
  );
});

test("a writer module may use write mechanics, for an app that writes on purpose", () => {
  const root = fixture({
    "app/lib/intuit/client.server.ts": goodClient,
    "app/lib/intuit/oauth.server.ts": goodOAuth,
    "app/lib/intuit/writer.server.ts": `export const url = "/v3/company/1/invoice?operation=update";`,
  });
  try {
    const problems = readOnlyProblems({
      ...options(root),
      allowedHostFiles: [...options(root).allowedHostFiles, "app/lib/intuit/writer.server.ts"],
      writerFile: "app/lib/intuit/writer.server.ts",
    });
    assert.deepEqual(problems, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an empty scan is reported rather than passing silently", () => {
  const root = fixture({ "README.md": "nothing to scan" });
  try {
    const problems = readOnlyProblems(options(root));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /No files found/);
    assert.equal(scannedFileCount(root, ["app"]), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
