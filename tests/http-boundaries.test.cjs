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

test('gathering HTML and real forms isolate private invitations and freeze the consent-filtered archive',{skip:!origin},async()=>{
 const route='/gatherings/fixture-private-gathering';
 const listing=await page('/gatherings');assert.ok(listing.text.includes('PUBLIC_GATHERING_TITLE'));assert.ok(!listing.text.includes('PRIVATE_GATHERING_TITLE'));
 assert.ok(!(await page('/literature')).text.includes('PUBLIC_GATHERING_TITLE'));
 for(const id of [null,'fixture-c']){const p=await page(route,id);assert.ok(!p.text.includes('PRIVATE_GATHERING_BODY'));assert.ok(!p.text.includes('PRIVATE_GATHERING_TITLE'));}
 const invited=await page(route,'fixture-b');assert.ok(invited.text.includes('PRIVATE_GATHERING_TITLE'));assert.ok(!invited.text.includes('PRIVATE_GATHERING_BODY'));
 async function submit(op,actor,values={}){
  const {text}=await page(route,actor),html=[...text.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(x=>x.includes(`name="op" value="${op}"`));assert.ok(html,op+' renders');
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&amp;/g,'&');const form=new FormData();
  for(const [tag] of html.matchAll(/<input\b[^>]*>/g)){const name=tag.match(/name="([^"]*)"/)?.[1],value=tag.match(/value="([^"]*)"/)?.[1]||'';if(name&&!tag.includes('type="checkbox"'))form.append(decode(name),decode(value));}
  for(const [k,v]of Object.entries(values))form.set(k,v);
  const r=await fetch(origin+route,{method:'POST',headers:{cookie:cookie(actor),origin},body:form,redirect:'manual'});assert.ok(r.status<400,op);return r;
 }
 await submit('join','fixture-b',{consent:'on'});assert.ok((await page(route,'fixture-b')).text.includes('PRIVATE_GATHERING_BODY'));
 await submit('post','fixture-b',{body:'UNARCHIVED_GATHERING_BODY',consent:'on'});
 assert.ok((await page(route,'fixture-a')).text.includes('UNARCHIVED_GATHERING_BODY'));
 await submit('close','fixture-a');
 const archive=await page(route,'fixture-b');assert.ok(archive.text.includes('PRIVATE_GATHERING_BODY'));assert.ok(!archive.text.includes('UNARCHIVED_GATHERING_BODY'));assert.ok(!archive.text.includes('name="op" value="post"'));assert.ok(archive.text.includes('集序'));
 assert.ok((await page('/gatherings','fixture-b')).text.includes('UNARCHIVED_GATHERING_BODY'),'own original remains available');
 assert.ok(!(await page(route,'fixture-c')).text.includes('PRIVATE_GATHERING_BODY'));
});

test('reading pages and real forms keep private copies out of HTML and other-day cohorts',{skip:!origin},async()=>{
 async function submit(route,id,op,values){
  const {text}=await page(route,id),form=[...text.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(x=>x.includes(`name="op" value="${op}"`));assert.ok(form,op+' form renders');
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');const data=new FormData();
  for(const m of form.matchAll(/<input\b[^>]*>/g)){const name=m[0].match(/name="([^"]*)"/)?.[1],value=m[0].match(/value="([^"]*)"/)?.[1]||'';if(name)data.append(decode(name),decode(value));}
  for(const [k,v]of Object.entries(values))data.set(k,v);
  const r=await fetch(origin+route,{method:'POST',headers:{cookie:cookie(id),origin},body:data,redirect:'manual'});assert.ok(r.status<400,op);return r;
 }
 const r=await page('/reading');assert.equal(r.status,200);assert.ok(r.text.includes('共读抄书'));assert.ok(r.text.includes('CC BY-SA 4.0'));
 await submit('/reading','fixture-a','save',{copy_body:'HTTP_PRIVATE_READING_COPY',note:'HTTP_SHARED_READING_NOTE',share:'on',consent:'on'});
 for(const uid of [null,'fixture-b','fixture-c']){const outsider=await page('/reading',uid);assert.ok(!outsider.text.includes('HTTP_PRIVATE_READING_COPY'));assert.ok(!outsider.text.includes('HTTP_SHARED_READING_NOTE'));}
 await submit('/reading','fixture-b','save',{copy_body:'B_PRIVATE_COPY',note:'B_PRIVATE_NOTE',share:'',consent:'on'});
 const joined=await page('/reading','fixture-b');assert.ok(joined.text.includes('HTTP_SHARED_READING_NOTE'));assert.ok(!joined.text.includes('HTTP_PRIVATE_READING_COPY'));
 assert.ok(!(await page('/reading','fixture-a')).text.includes('B_PRIVATE_NOTE'));
 assert.ok(!(await page('/reading/mine','fixture-c')).text.includes('HTTP_PRIVATE_READING_COPY'));
 assert.ok((await page('/reading/mine','fixture-a')).text.includes('HTTP_PRIVATE_READING_COPY'));
 await submit('/reading','fixture-a','unshare',{});
 assert.ok(!(await page('/reading','fixture-b')).text.includes('HTTP_SHARED_READING_NOTE'));
 await submit('/reading','fixture-b','leave',{});
 assert.ok((await page('/reading/mine','fixture-b')).text.includes('B_PRIVATE_COPY'));
 assert.ok(!(await page('/reading/review','fixture-c')).text.includes('HTTP_PRIVATE_READING_COPY'));
 const seasons=await page('/seasons');assert.equal(seasons.status,200);assert.ok(seasons.text.includes('节气与岁时'));
});

test('travel HTML, public pins and real edit actions respect private scope and withdrawal',{skip:!origin},async()=>{
 async function submit(route,id,op,values){const {text}=await page(route,id),form=[...text.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(x=>x.includes(`name="op" value="${op}"`));assert.ok(form,op+' form renders');const decode=s=>s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');const data=new FormData();for(const m of form.matchAll(/<input\b[^>]*>/g)){const name=m[0].match(/name="([^"]*)"/)?.[1],value=m[0].match(/value="([^"]*)"/)?.[1]||'';if(name)data.append(decode(name),decode(value));}for(const[k,v]of Object.entries(values))data.set(k,v);const r=await fetch(origin+route,{method:'POST',headers:{cookie:cookie(id),origin},body:data,redirect:'manual'});assert.ok(r.status<400,op);return r;}
 const home=await page('/travel');assert.equal(home.status,200);assert.ok(home.text.includes('云游地图'));assert.ok(!home.text.includes('PENDING_PRIVATE_TITLE'));
 const search=await fetch(origin+'/api/travel/places?q='+encodeURIComponent('京都'));assert.equal(search.status,200);const found=await search.json();assert.ok(found.places.some(p=>p.english==='Kyoto'));
 const form={title:'HTTP_PRIVATE_TRAVEL_TITLE',body:'HTTP_PRIVATE_TRAVEL_BODY',location_kind:'manual',place_name:'HTTP_PRIVATE_TRAVEL_PLACE',longitude:'120.15',latitude:'30.27',visibility:'private'};
 const created=await submit('/travel/new','fixture-a','save',form),route=created.headers.get('location');assert.match(route,/^\/travel\//);
 assert.ok((await page(route,'fixture-a')).text.includes(form.body));
 for(const uid of [null,'fixture-b']){for(const path of [route,route+'/edit','/travel','/travel/mine']){const r=await page(path,uid);assert.ok(!r.text.includes(form.title));assert.ok(!r.text.includes(form.body));assert.ok(!r.text.includes(form.place_name));}}
 assert.ok((await page('/travel/mine','fixture-a')).text.includes(form.title));
 await submit(route+'/edit','fixture-a','save',{...form,visibility:'public',consent:'on'});
 const pub=await page(route);assert.ok(pub.text.includes(form.body));const map=await page('/travel');assert.ok(map.text.includes(form.title));assert.ok(map.text.includes(form.place_name));
 await submit(route,'fixture-a','private',{});
 assert.ok(!(await page(route)).text.includes(form.body));assert.ok(!(await page('/travel')).text.includes(form.title));
 const assets=await fetch(origin+'/geography/world-land.json');assert.equal(assets.status,200);assert.ok((await assets.json()).length>100);
});

test('quarterly HTTP forms keep drafts and proof PDFs private and revoke public HTML/PDF after withdrawal',{skip:!origin},async()=>{
 const {createClient}=require('@libsql/client'),{journalMutation}=require('../lib/journal-service.ts');const client=createClient({url:'file:'+process.env.MDJ_DB});
 async function submit(route,uid,op,values){const{text}=await page(route,uid),form=[...text.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(x=>x.includes(`name="op" value="${op}"`));assert.ok(form,op+' form');const decode=s=>s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');const data=new FormData();for(const m of form.matchAll(/<input\b[^>]*>/g)){const name=m[0].match(/name="([^"]*)"/)?.[1],value=m[0].match(/value="([^"]*)"/)?.[1]||'';if(name&&!m[0].includes('type="checkbox"'))data.append(decode(name),decode(value));}for(const[k,v]of Object.entries(values))data.set(k,v);const r=await fetch(origin+route,{method:'POST',headers:{cookie:cookie(uid),origin},body:data,redirect:'manual'});assert.ok(r.status<400,op);return r;}
 try{
  const admin=String((await client.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")).rows[0].id);await client.execute({sql:"UPDATE users SET literary_name='站主' WHERE id=?",args:[admin]});const now=Date.now(),run=(u,op,d)=>journalMutation(client,u,op,d,now);
  const{issue}=await run(admin,'issue-save',{title:'HTTP刊期',period:'二〇二六年冬',foreword:'公开刊首语',send_key:'http-journal-issue-key'});await run(admin,'issue-state',{id:issue,revision:'0',state:'open'});
  await submit('/journal/new?issue='+issue,'fixture-a','save',{title:'PRIVATE_JOURNAL_HTTP_TITLE',body:'PRIVATE_JOURNAL_HTTP_BODY',byline:'甲笺'});
  const entry=(await client.execute({sql:'SELECT * FROM journal_submissions WHERE issue_id=?',args:[issue]})).rows[0],id=String(entry.id),route='/journal/submission/'+id;
  for(const uid of [null,'fixture-b']){const r=await page(route,uid);assert.ok(!r.text.includes('PRIVATE_JOURNAL_HTTP_TITLE'));assert.ok(!r.text.includes('PRIVATE_JOURNAL_HTTP_BODY'));}
  await client.execute("UPDATE users SET role='admin' WHERE id='fixture-c'");let edit=await page('/journal/edit/'+issue,'fixture-c');assert.ok(!edit.text.includes('PRIVATE_JOURNAL_HTTP_TITLE'));assert.ok(!edit.text.includes('PRIVATE_JOURNAL_HTTP_BODY'));
  await submit(route,'fixture-a','save',{title:'PUBLIC_JOURNAL_HTTP_TITLE',body:'PUBLIC_JOURNAL_HTTP_BODY 繁體與简体',byline:'甲笺',submit:'on',review_consent:'on'});
  edit=await page('/journal/edit/'+issue,'fixture-c');assert.ok(edit.text.includes('PUBLIC_JOURNAL_HTTP_BODY'));await client.execute("UPDATE users SET role='member' WHERE id='fixture-c'");
  await run(admin,'select',{id,revision:'1',issue_revision:'0',selected:'on',position:'1'});await run(admin,'issue-state',{id:issue,revision:'1',state:'proof'});
  for(const uid of [null,'fixture-b'])assert.equal((await fetch(origin+route+'/pdf',{headers:{cookie:cookie(uid)}})).status,404);
  const proof=await fetch(origin+route+'/pdf',{headers:{cookie:cookie('fixture-a')}});assert.equal(proof.status,200);assert.equal(proof.headers.get('content-type'),'application/pdf');assert.equal(proof.headers.get('cache-control'),'private, no-store');assert.equal(Buffer.from(await proof.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  assert.equal((await fetch(origin+'/journal/'+issue+'/pdf')).status,404);assert.ok(!(await page('/journal/'+issue)).text.includes('PUBLIC_JOURNAL_HTTP_BODY'));
  await submit(route,'fixture-a','approve',{consent:'on'});await run(admin,'issue-state',{id:issue,revision:'1',state:'published',consent:'on'});
  assert.ok((await page('/journal/'+issue)).text.includes('PUBLIC_JOURNAL_HTTP_BODY'));const pdf=await fetch(origin+'/journal/'+issue+'/pdf');assert.equal(pdf.status,200);assert.equal(pdf.headers.get('cache-control'),'private, no-store');assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  await submit(route,'fixture-a','withdraw',{});assert.ok(!(await page('/journal/'+issue)).text.includes('PUBLIC_JOURNAL_HTTP_BODY'));assert.ok((await page(route,'fixture-a')).text.includes('PUBLIC_JOURNAL_HTTP_BODY'));assert.equal((await fetch(origin+route+'/pdf',{headers:{cookie:cookie('fixture-a')}})).status,404);
  await run(admin,'issue-state',{id:issue,revision:'1',state:'withdrawn',consent:'on'});assert.equal((await fetch(origin+'/journal/'+issue+'/pdf')).status,404);
 }finally{client.close();}
});
