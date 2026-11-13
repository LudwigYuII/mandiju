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

test(
  "study pages exclude private RSC text and a real form submission preserves revision and authorization",
  { skip: !origin },
  async () => {
    const route = "/study/" + encodeURIComponent("甲笺");
    for (const id of [null, "fixture-c"]) {
      const r = await page(route, id);
      assert.equal(r.status, 200);
      assert.ok(r.text.includes("PUBLIC_STUDY_INTRO"));
      assert.ok(!r.text.includes("PRIVATE_STUDY_NOTE"));
    }
    assert.ok(
      (await page(route, "fixture-b")).text.includes("PRIVATE_STUDY_NOTE"),
    );
    const r = await page("/study/edit", "fixture-a");
    assert.equal(r.status, 200);
    const html = r.text.match(
      /<form[^>]*>[\s\S]*?name="op" value="profile"[\s\S]*?<\/form>/,
    )?.[0];
    assert.ok(html, "profile form must be rendered");
    const decode = (s) =>
      s
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const data = new FormData();
    for (const m of html.matchAll(/<input\b[^>]*>/g)) {
      const name = m[0].match(/name="([^"]*)"/)?.[1],
        value = m[0].match(/value="([^"]*)"/)?.[1] || "";
      if (name) data.append(decode(name), decode(value));
    }
    data.set("name", "试墨斋");
    data.set("public_intro", "PUBLIC_UPDATED_INTRO");
    data.set("inner_note", "PRIVATE_UPDATED_NOTE");
    const submitted = await fetch(origin + "/study/edit", {
      method: "POST",
      headers: { cookie: cookie("fixture-a"), origin },
      body: data,
      redirect: "manual",
    });
    assert.ok(submitted.status < 400, "server action form must submit");
    const owner = await page(route, "fixture-a");
    assert.ok(owner.text.includes("PRIVATE_UPDATED_NOTE"));
    const outsider = await page(route, "fixture-c");
    assert.ok(outsider.text.includes("PUBLIC_UPDATED_INTRO"));
    assert.ok(!outsider.text.includes("PRIVATE_UPDATED_NOTE"));
    const { createClient } = require("@libsql/client");
    const db = createClient({ url: "file:" + process.env.MDJ_DB });
    try {
      await db.execute(
        "UPDATE study_visits SET status='revoked' WHERE owner_id='fixture-a' AND visitor_id='fixture-b'",
      );
    } finally {
      db.close();
    }
    assert.ok(
      !(await page(route, "fixture-b")).text.includes("PRIVATE_UPDATED_NOTE"),
      "revoked visitor cannot read through an old route",
    );
    const anonymous=await page("/visits",null);
  assert.ok(anonymous.status===307 || /NEXT_REDIRECT;replace;\/login;307|http-equiv="refresh" content="0;url=\/login"/.test(anonymous.text));
  },
);

test('real literary pages and form actions protect scroll invitation and colophon review boundaries',{skip:!origin},async()=>{
  async function submit(path,id,op,values){
    const {text}=await page(path,id);
    const form=[...text.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(x=>x.includes(`name="op" value="${op}"`));
    assert.ok(form,`${op} form should render`);
    const decode=s=>s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    const data=new FormData();for(const m of form.matchAll(/<input\b[^>]*>/g)){const name=m[0].match(/name="([^"]*)"/)?.[1],value=m[0].match(/value="([^"]*)"/)?.[1]||'';if(name)data.append(decode(name),decode(value));}
    for(const [k,v] of Object.entries(values))data.set(k,v);
    const r=await fetch(origin+path,{method:'POST',headers:{cookie:cookie(id),origin},body:data,redirect:'manual'});assert.ok(r.status<400,op);return r;
  }
  const home=await page('/literature');assert.ok(home.text.includes('PUBLIC_SCROLL_TITLE'));assert.ok(!home.text.includes('PRIVATE_SCROLL_TITLE'));
  for(const id of [null,'fixture-c'])for(const route of ['/literature/fixture-private-scroll','/works/fixture-private-work']){const r=await page(route,id);assert.ok(!r.text.includes('PRIVATE_WORK_BODY'));assert.ok(!r.text.includes('PRIVATE_SCROLL_TITLE'));}
  const invited=await page('/literature/fixture-private-scroll','fixture-b');assert.ok(invited.text.includes('PRIVATE_SCROLL_TITLE'));assert.ok(!invited.text.includes('PRIVATE_WORK_BODY'));
  await submit('/literature/fixture-private-scroll','fixture-b','join',{consent:'on'});
  assert.ok((await page('/works/fixture-private-work','fixture-b')).text.includes('PRIVATE_WORK_BODY'));
  await submit('/literature/fixture-private-scroll','fixture-b','append',{title:'和作题',body:'PRIVATE_APPENDED_BODY',consent:'on'});
  assert.ok((await page('/literature/fixture-private-scroll','fixture-a')).text.includes('PRIVATE_APPENDED_BODY'));
  assert.ok(!(await page('/literature/fixture-private-scroll','fixture-c')).text.includes('PRIVATE_APPENDED_BODY'));
  await submit('/works/fixture-public-work','fixture-b','colophon',{body:'PENDING_LITERARY_NOTE',consent:'on'});
  assert.ok(!(await page('/works/fixture-public-work')).text.includes('PENDING_LITERARY_NOTE'));
  assert.ok((await page('/works/fixture-public-work','fixture-a')).text.includes('PENDING_LITERARY_NOTE'));
  await submit('/works/fixture-public-work','fixture-a','collect',{});
  assert.ok((await page('/works/fixture-public-work')).text.includes('PENDING_LITERARY_NOTE'));
  await submit('/works/fixture-public-work','fixture-b','withdraw_note',{});
  assert.ok(!(await page('/works/fixture-public-work')).text.includes('PENDING_LITERARY_NOTE'));
  assert.ok(!(await page('/works/fixture-public-work','fixture-a')).text.includes('PENDING_LITERARY_NOTE'));
  // Real create action defaults to a private scope and redirects to the newly committed scroll.
  const created=await submit('/literature/new','fixture-c','create',{title:'NEW_PRIVATE_SCROLL_TITLE',body:'NEW_PRIVATE_SCROLL_BODY',capacity:'12',consent:'on'});
  const location=created.headers.get('location');assert.match(location,/^\/literature\//);
  assert.ok((await page(location,'fixture-c')).text.includes('NEW_PRIVATE_SCROLL_BODY'));
  assert.ok(!(await page(location)).text.includes('NEW_PRIVATE_SCROLL_BODY'));
});
