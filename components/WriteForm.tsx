"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  createLetterAction,
  saveDraftAction,
  deleteDraftAction,
  type ActionState,
} from "@/lib/actions";
import { GENRES, POSTAGE, postageCost } from "@/lib/delivery";
import { imgUrl } from "@/lib/assets";
import Stamp from "./Stamp";
import Postmark from "./Postmark";
import FutureDatePicker from "./FutureDatePicker";

type PenPal = { pen: string; avatarId: string; bgId: string };
type StampOpt = { id: string; name: string; file: string; seasonal?: string };
type GeoWeather = { city: string; temp: number | null; code: number | null; gust: number | null };
type Draft = {
  id: string;
  genre: string;
  title: string;
  body: string;
  postage: string;
  stampId: string;
  recipient: string;
  city: string;
  weather: string;
  image: string;
  capsuleDate: string;
  topicId: string;
  replyTo: string;
  updatedAt: number;
};

const WEATHER: { code: number; emoji: string; label: string }[] = [
  { code: 0, emoji: "☀️", label: "晴" },
  { code: 1, emoji: "🌤️", label: "多云转晴" },
  { code: 3, emoji: "☁️", label: "阴" },
  { code: 61, emoji: "🌧️", label: "雨" },
  { code: 71, emoji: "🌨️", label: "雪" },
  { code: 45, emoji: "🌫️", label: "雾" },
  { code: 95, emoji: "⛈️", label: "雷雨" },
];

function playThud() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.16);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.24);
  } catch {}
}

export default function WriteForm({
  pen,
  penpals,
  stamps,
  coins,
  topic,
  reply,
  drafts,
}: {
  pen: string;
  penpals: PenPal[];
  stamps: StampOpt[];
  coins: number;
  topic?: { id: string; title: string } | null;
  reply?: { id: string; title: string; authorPen: string } | null;
  drafts: Draft[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLetterAction, {});
  const [, startTransition] = useTransition();
  const [genre, setGenre] = useState<string>(drafts[0]?.genre ?? "letter");
  const [postage, setPostage] = useState<string>(drafts[0]?.postage || "surface");
  const [stampId, setStampId] = useState<string>(drafts[0]?.stampId || stamps[0]?.id || "");
  const [recipient, setRecipient] = useState<string>(
    reply ? reply.authorPen : drafts[0]?.recipient ?? ""
  );
  const [title, setTitle] = useState(drafts[0]?.title ?? (reply ? `回：《${reply.title}》` : ""));
  const [body, setBody] = useState(drafts[0]?.body ?? "");
  const [city, setCity] = useState(drafts[0]?.city ?? "");
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [stamping, setStamping] = useState(false);
  const [imageUrl, setImageUrl] = useState(drafts[0]?.image ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [capsuleDate, setCapsuleDate] = useState<string | null>(drafts[0]?.capsuleDate || null);
  const [draftId, setDraftId] = useState("");
  const [replyTo, setReplyTo] = useState(reply?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [draftMsg, setDraftMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const isCapsule = recipient === "__future__";
  const isPostcard = genre === "postcard";
  const cost = isCapsule ? 0 : postageCost(postage);
  const weather: GeoWeather | null =
    weatherCode != null ? { city, temp: null, code: weatherCode, gust: null } : null;

  const pickImage = async (f: File) => {
    setUploading(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        setUploadErr(j.error || "上传失败");
        return;
      }
      setImageUrl(j.url);
    } catch {
      setUploadErr("上传失败");
    } finally {
      setUploading(false);
    }
  };

  const saveDraft = async () => {
    if (!title.trim() && !body.trim()) {
      setDraftMsg("还没有内容可存");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("draftId", draftId);
    fd.set("genre", genre);
    fd.set("title", title);
    fd.set("body", body);
    fd.set("postage", isCapsule ? "slow" : postage);
    fd.set("stampId", stampId);
    fd.set("recipient", recipient);
    fd.set("city", city);
    fd.set("weather", JSON.stringify(weather));
    fd.set("image", imageUrl);
    fd.set("capsuleDate", capsuleDate ?? "");
    fd.set("topicId", topic?.id ?? "");
    fd.set("replyTo", replyTo);
    const res = await saveDraftAction({}, fd);
    setSaving(false);
    if ((res as any)?.draftId) setDraftId((res as any).draftId);
    setDraftMsg((res as any)?.ok ? "草稿已存" : (res as any)?.error ?? "");
    setTimeout(() => setDraftMsg(""), 2500);
  };

  const loadDraft = (d: Draft) => {
    setDraftId(d.id);
    setGenre(d.genre);
    setPostage(d.postage || "surface");
    setStampId(d.stampId || stamps[0]?.id || "");
    setRecipient(d.recipient);
    setTitle(d.title);
    setBody(d.body);
    setCity(d.city);
    setImageUrl(d.image);
    setCapsuleDate(d.capsuleDate || null);
    setReplyTo(d.replyTo);
    setWeatherCode(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeDraft = (id: string) => {
    const fd = new FormData();
    fd.set("draftId", id);
    startTransition(() => deleteDraftAction(fd));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!city.trim()) return;
    if (!isCapsule && coins < cost) return;
    if (isPostcard && !imageUrl) {
      setUploadErr("明信片需要一张图");
      return;
    }
    if (isCapsule && !capsuleDate) return;
    playThud();
    const fd = new FormData(e.currentTarget);
    setStamping(true);
    setTimeout(() => {
      startTransition(() => formAction(fd));
    }, 1000);
  };

  const submitDisabled =
    pending || stamping || !city.trim() || (!isCapsule && coins < cost) || (isCapsule && !capsuleDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-soft">以</span>
          <span className="font-semibold">{pen}</span>
          <span className="text-sm text-ink-soft">的名义写信</span>
        </div>
        <span className="text-sm text-ink-soft">余额 {coins} 文</span>
      </div>

      {/* 草稿箱 */}
      {drafts.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <span className="text-xs font-semibold tracking-[0.18em] text-ink-soft">草稿</span>
          {drafts.map((d) => (
            <span
              key={d.id}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                draftId === d.id ? "border-vermilion/50 text-vermilion" : "border-black/10 text-ink-soft dark:border-white/15"
              }`}
            >
              <button type="button" onClick={() => loadDraft(d)}>
                {d.title || "（无题）"}
              </button>
              <button
                type="button"
                onClick={() => removeDraft(d.id)}
                className="opacity-50 hover:opacity-100"
                title="删除"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-7">
        <input type="hidden" name="genre" value={genre} />
        <input type="hidden" name="postage" value={isCapsule ? "slow" : postage} />
        <input type="hidden" name="stampId" value={stampId} />
        <input type="hidden" name="weather" value={JSON.stringify(weather)} />
        <input type="hidden" name="recipient" value={recipient} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="image" value={imageUrl} />
        <input type="hidden" name="capsuleDate" value={capsuleDate ?? ""} />
        <input type="hidden" name="replyTo" value={replyTo} />
        <input type="hidden" name="draftId" value={draftId} />
        {topic && <input type="hidden" name="topicId" value={topic.id} />}

        {topic && (
          <div className="card flex items-center gap-2 !border-vermilion/40 bg-vermilion/5 p-3.5">
            <span className="text-xs font-semibold tracking-[0.18em] text-vermilion">本月同题</span>
            <span className="text-sm font-semibold">{topic.title}</span>
          </div>
        )}

        {reply && (
          <div className="card flex items-center gap-2 !border-postblue/40 bg-postblue/5 p-3.5">
            <span className="text-xs font-semibold tracking-[0.18em] text-postblue">回信</span>
            <span className="text-sm">
              回给 <b>{reply.authorPen}</b> 的《{reply.title}》
            </span>
          </div>
        )}

        {/* 寄给谁 */}
        <section>
          <h3 className="mb-2.5 text-sm font-semibold">寄给</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRecipient("")}
              className={`btn-ghost ${recipient === "" ? "!border-vermilion !text-vermilion" : ""}`}
            >
              🌐 所有人
            </button>
            {penpals.slice(0, 8).map((p) => (
              <button
                key={p.pen}
                type="button"
                onClick={() => setRecipient(recipient === p.pen ? "" : p.pen)}
                className={`btn-ghost ${recipient === p.pen ? "!border-vermilion !text-vermilion" : ""}`}
              >
                ✉️ {p.pen}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRecipient(recipient === "__future__" ? "" : "__future__")}
              className={`btn-ghost ${isCapsule ? "!border-vermilion !text-vermilion" : ""}`}
            >
              ⏳ 未来的自己
            </button>
          </div>
          {recipient && !isCapsule && <p className="mt-2 text-xs text-ink-soft">这封信只有你俩能看见</p>}
        </section>

        {/* 体裁 */}
        <section>
          <h3 className="mb-2.5 text-sm font-semibold">体裁</h3>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenre(g.id)}
                className={`btn-ghost ${genre === g.id ? "!border-vermilion !text-vermilion" : ""}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </section>

        {/* 正文 / 明信片 */}
        <section className="card glass space-y-3 p-5">
          {isPostcard ? (
            <>
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(imageUrl)} alt="明信片" className="h-24 w-32 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-24 w-32 items-center justify-center rounded-xl bg-paper2/50 text-xs text-ink-soft">
                    还没有图
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="btn-ghost !px-4 !py-2 !text-sm"
                    disabled={uploading}
                  >
                    {uploading ? "上传中…" : imageUrl ? "换一张" : "选一张图"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickImage(f);
                    }}
                  />
                  {uploadErr && <p className="mt-1 text-xs text-vermilion">{uploadErr}</p>}
                </div>
              </div>
              <textarea
                name="body"
                rows={2}
                className="input resize-y !border-0 !bg-transparent !p-0 !text-lg"
                placeholder="写一句话…"
                maxLength={120}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </>
          ) : (
            <>
              <input
                name="title"
                className="input !border-0 !bg-transparent !p-0 !text-xl font-semibold"
                placeholder="信的标题"
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="h-px bg-black/5 dark:bg-white/10" />
              <textarea
                name="body"
                rows={8}
                className={`input resize-y !border-0 !bg-transparent !p-0 ${
                  genre === "poem" ? "poem" : ""
                }`}
                placeholder={genre === "poem" ? "写一首诗" : "展信佳"}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </>
          )}
        </section>

        {/* 邮资 / 时光胶囊 */}
        <section>
          <h3 className="mb-2.5 text-sm font-semibold">{isCapsule ? "解锁日期" : "邮资"}</h3>
          {isCapsule ? (
            <div className="space-y-2">
              <FutureDatePicker value={capsuleDate} onChange={setCapsuleDate} />
              <p className="text-xs text-ink-soft">零邮资。信会沉睡到解锁那天，只有你自己能看见。</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {POSTAGE.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPostage(p.id)}
                  className={`card p-3.5 text-left transition ${
                    postage === p.id ? "!border-vermilion/60 shadow-md" : ""
                  }`}
                >
                  <div className="text-[15px] font-semibold">{p.label}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">{p.desc}</div>
                  <div className="mt-1 text-xs text-vermilion">{p.cost} 文</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 邮票 */}
        <section>
          <h3 className="mb-2.5 text-sm font-semibold">贴一枚邮票</h3>
          <div className="-mx-2 -my-2 flex gap-2 overflow-x-auto px-2 py-2">
            {stamps.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStampId(s.id)}
                className={`relative shrink-0 rounded-xl p-1 ${
                  stampId === s.id ? "bg-vermilion/10 ring-2 ring-vermilion" : ""
                }`}
              >
                <Stamp file={s.file} size={72} />
                {s.seasonal && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-vermilion px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {s.seasonal}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            邮票只作纪念，不影响送达速度；带「限定」标的票用后即入藏
          </p>
        </section>

        {/* 官戳 */}
        <section>
          <h3 className="mb-2.5 text-sm font-semibold">盖官戳</h3>
          <div className="flex items-start gap-5">
            <div className="flex-1 space-y-3">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">城市</span>
                <input
                  className="input !w-40"
                  placeholder="如：杭州"
                  maxLength={8}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-ink-soft">将环绕印在官戳上，投递前必填</p>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">当日天气（可选）</span>
                <div className="flex flex-wrap gap-2">
                  {WEATHER.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setWeatherCode(weatherCode === m.code ? null : m.code)}
                      className={`btn-ghost ${
                        weatherCode === m.code ? "!border-vermilion !text-vermilion" : ""
                      }`}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <Postmark city={city.trim() || undefined} time={Date.now()} size={112} />
            </div>
          </div>
        </section>

        <div className="flex gap-2">
          <button type="submit" className="btn flex-1 !py-3.5 !text-base" disabled={submitDisabled}>
            {stamping || pending
              ? "投递中…"
              : !city.trim()
                ? "先填写城市"
                : isCapsule && !capsuleDate
                  ? "先选解锁日期"
                  : !isCapsule && coins < cost
                    ? `「文」不足（需 ${cost} 文）`
                    : isCapsule
                      ? "封存"
                      : "投递"}
          </button>
          <button type="button" onClick={saveDraft} className="btn-ghost !px-5 !text-sm" disabled={saving}>
            {saving ? "保存中…" : "存草稿"}
          </button>
        </div>
        {draftMsg && <p className="text-center text-xs text-postblue">{draftMsg}</p>}
        {state?.error && <p className="text-sm text-vermilion">{state.error}</p>}
      </form>

      {/* 盖章动画 */}
      {stamping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="stamp-flash pointer-events-none fixed inset-0 bg-vermilion" />
          <div className="card flex h-72 w-56 flex-col items-center justify-center gap-4 bg-paper">
            <div className="stamp-thud">
              <Postmark city={city.trim() || "慢递"} time={Date.now()} size={120} />
            </div>
            <p className="text-sm text-ink-soft">{isCapsule ? "封存…" : "盖戳寄出…"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
