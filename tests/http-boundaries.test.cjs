const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const origin = process.env.MDJ_TEST_ORIGIN;
const tokens = origin
  ? JSON.parse(fs.readFileSync(process.env.MDJ_TEST_COOKIES, "utf8"))
  : {};
const cookie = (id) => (id ? `mdj_session=${tokens[id]}` : "");
async function page(path, id) {
  const response = await fetch(origin + path, {
    headers: { cookie: cookie(id) },
    redirect: "manual",
  });
  return { status: response.status, text: await response.text() };
}
test(
  "live routes do not expose pending private content or private references",
  { skip: !origin },
  async () => {
    for (const [path, id] of [
      ["/letter/fixture-pending", "fixture-b"],
      ["/letter/fixture-pending", "fixture-c"],
      ["/write?reply=fixture-pending", "fixture-c"],
      ["/letter/fixture-capsule", "fixture-b"],
      ["/print?scope=with&with=" + encodeURIComponent("甲笺"), "fixture-b"],
      ["/mail", "fixture-b"],
      ["/settings", "fixture-b"],
      ["/topics", null],
      ["/letter/fixture-public", null],
    ]) {
      const response = await page(path, id);
      assert.notEqual(response.status, 500, path);
      assert.ok(
        !response.text.includes("PENDING_PRIVATE_TITLE"),
        path + " exposed pending title",
      );
      assert.ok(
        !response.text.includes("PENDING_PRIVATE_BODY"),
        path + " exposed pending body",
      );
      assert.ok(
        !response.text.includes("CAPSULE_HIDDEN_BODY"),
        path + " exposed capsule body",
      );
    }
    const recipient = await page("/letter/fixture-delivered", "fixture-b");
    assert.equal(recipient.status, 200);
    assert.ok(recipient.text.includes("DELIVERED_PRIVATE_BODY"));
    const outsider = await page("/letter/fixture-delivered", "fixture-c");
    assert.ok(!outsider.text.includes("DELIVERED_PRIVATE_BODY"));
    assert.match(
      outsider.text,
      /NEXT_HTTP_ERROR_FALLBACK;404|name="robots" content="noindex"/,
    );
  },
);
test(
  "cron rejects a forged User-Agent without its secret",
  { skip: !origin },
  async () => {
    const response = await fetch(origin + "/api/cron", {
      headers: { "user-agent": "vercel-cron/1.0" },
    });
    assert.equal(response.status, 401);
  },
);
test(
  "upload decodes image data and media is not public before attachment",
  { skip: !origin },
  async () => {
    const sharp = require("sharp");
    const bad = new FormData();
    bad.set(
      "file",
      new File(["<html>not an image</html>"], "fake.jpg", {
        type: "image/jpeg",
      }),
    );
    let response = await fetch(origin + "/api/upload", {
      method: "POST",
      headers: { cookie: cookie("fixture-a") },
      body: bad,
    });
    assert.equal(response.status, 400);
    const bytes = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#758171" },
    })
      .jpeg()
      .toBuffer();
    const form = new FormData();
    form.set("file", new File([bytes], "photo.jpg", { type: "image/jpeg" }));
    response = await fetch(origin + "/api/upload", {
      method: "POST",
      headers: { cookie: cookie("fixture-a") },
      body: form,
    });
    assert.equal(response.status, 200);
    const { url } = await response.json();
    assert.match(url, /^api\/media\//);
    const owner = await fetch(origin + "/" + url, {
      headers: { cookie: cookie("fixture-a") },
    });
    assert.equal(owner.status, 200);
    assert.equal(owner.headers.get("cache-control"), "private, no-store");
    const metadata = await sharp(
      Buffer.from(await owner.arrayBuffer()),
    ).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(
      (
        await fetch(origin + "/" + url, {
          headers: { cookie: cookie("fixture-c") },
        })
      ).status,
      404,
    );
    assert.equal((await fetch(origin + "/" + url)).status, 404);
  },
);
