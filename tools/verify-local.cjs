const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "yaji-test-"));
const env = {
  ...process.env,
  MDJ_DB: path.join(work, "site.db"),
  MDJ_SECRET: crypto.randomBytes(32).toString("hex"),
  MDJ_ADMIN_PASS: crypto.randomBytes(24).toString("hex"),
  MDJ_PRIVATE_STORAGE: path.join(work, "media"),
  CRON_SECRET: crypto.randomBytes(32).toString("hex"),
  MDJ_TEST_FIXTURE: "1",
  MDJ_TEST_COOKIES: path.join(work, "cookies.json"),
  MDJ_TEST_ORIGIN: "http://127.0.0.1:3111",
  NEXT_TELEMETRY_DISABLED: "1",
};
function run(args, extra = {}) {
  const result = spawnSync(process.execPath, args, {
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`Command failed: ${args.join(" ")}`);
}
(async () => {
  run(["--require", "tsx/cjs", "tests/seed-local.cjs"]);
  const log = fs.openSync(path.join(work, "server.log"), "a");
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3111",
    ],
    { env, stdio: ["ignore", log, log] },
  );
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(env.MDJ_TEST_ORIGIN + "/api/health");
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready)
      throw new Error(
        "Local production server did not start: " +
          fs.readFileSync(path.join(work, "server.log"), "utf8"),
      );
    run([
      "--require",
      "tsx/cjs",
      "--test",
      ...fs
        .readdirSync("tests")
        .filter((x) => x.endsWith(".test.cjs"))
        .map((x) => "tests/" + x),
    ]);
    // Exercise export/restore with an actual anonymous database, never the production source.
    run(["tools/export-backup.mjs", path.join(work, "backups")]);
    run([
      "--require",
      "tsx/cjs",
      "tools/export-media-backup.cjs",
      path.join(work, "backups"),
    ]);
    const snapshot = path.join(
      work,
      "backups",
      fs.readdirSync(path.join(work, "backups"))[0],
    );
    run(["tools/restore-backup.mjs", snapshot], {
      MDJ_RESTORE_DB: path.join(work, "restored.db"),
    });
    run(["--require", "tsx/cjs", "tools/restore-media-backup.cjs", snapshot], {
      MDJ_DB: path.join(work, "restored.db"),
      MDJ_PRIVATE_STORAGE: path.join(work, "restored-media"),
    });
    const archive = path.join(work, "archive.tar.gz"),
      key = path.join(work, "key.pem"),
      certificate = path.join(work, "certificate.pem");
    const bin = (command, args) => {
      const r = spawnSync(command, args, { stdio: "pipe" });
      if (r.status !== 0) throw new Error(command + " failed");
    };
    bin("tar", ["-czf", archive, "-C", work, "backups"]);
    bin("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      certificate,
      "-subj",
      "/CN=anonymous-backup-test",
      "-days",
      "1",
    ]);
    bin("openssl", [
      "cms",
      "-encrypt",
      "-binary",
      "-aes-256-cbc",
      "-in",
      archive,
      "-out",
      path.join(work, "backup.p7m"),
      "-outform",
      "DER",
      certificate,
    ]);
    bin("openssl", [
      "cms",
      "-decrypt",
      "-binary",
      "-inform",
      "DER",
      "-in",
      path.join(work, "backup.p7m"),
      "-recip",
      certificate,
      "-inkey",
      key,
      "-out",
      path.join(work, "decrypted.tar.gz"),
    ]);
    assert.deepEqual(
      fs.readFileSync(archive),
      fs.readFileSync(path.join(work, "decrypted.tar.gz")),
    );
    console.log("Encrypted archive decrypts byte-for-byte correctly.");
    let playwright;
    try {
      playwright = require("playwright");
    } catch {}
    if (playwright && process.argv.includes("--screenshots")) {
      const browser = await playwright.chromium.launch({
        executablePath: "/usr/bin/chromium",
        args: ["--no-sandbox"],
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 1280, height: 900 },
        });
        const tokens = JSON.parse(
          fs.readFileSync(env.MDJ_TEST_COOKIES, "utf8"),
        );
        await page
          .context()
          .addCookies([
            {
              name: "mdj_session",
              value: tokens["fixture-b"],
              url: env.MDJ_TEST_ORIGIN,
            },
          ]);
        await page.goto(env.MDJ_TEST_ORIGIN, { waitUntil: "networkidle" });
        await page.screenshot({
          path: "/tmp/yaji-home-desktop.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(env.MDJ_TEST_ORIGIN, { waitUntil: "networkidle" });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          "mobile horizontal overflow",
        );
        await page.screenshot({
          path: "/tmp/yaji-home-mobile.png",
          fullPage: true,
        });
        await page.goto(env.MDJ_TEST_ORIGIN + "/settings", {
          waitUntil: "networkidle",
        });
        await page.getByRole("button", { name: "繁体", exact: true }).click();
        await page.waitForFunction(
          () => document.documentElement.lang === "zh-Hant",
        );
        assert.ok((await page.locator("body").innerText()).includes("來信"));
        console.log("Desktop/mobile render and live language switch verified.");
      } finally {
        await browser.close();
      }
    }
    console.log("Local production verification passed.");
  } finally {
    server.kill("SIGTERM");
    fs.closeSync(log);
  }
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });
