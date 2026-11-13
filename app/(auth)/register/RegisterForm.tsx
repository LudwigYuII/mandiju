"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/lib/actions";
import BirthdayPicker from "@/components/BirthdayPicker";
import Seal from "@/components/Seal";

type Av = { id: string; name: string; file: string };
type Bg = { id: string; name: string; file: string };

function EyeToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft"
    >
      <UiText text={shown ? "隐藏" : "显示"} />
    </button>
  );
}

export default function RegisterForm({
  avatars,
  backgrounds,
}: {
  avatars: Av[];
  backgrounds: Bg[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    registerAction,
    {},
  );
  const [, startTransition] = useTransition();
  const [avatarId, setAvatarId] = useState(avatars[0]?.id ?? "C01");
  const [bgId, setBgId] = useState(backgrounds[0]?.id ?? "D01");
  const [pen, setPen] = useState("");
  const [seal, setSeal] = useState("");
  const [sealTouched, setSealTouched] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [clientErr, setClientErr] = useState("");

  const onPen = (v: string) => {
    setPen(v);
    if (!sealTouched) setSeal(v ? v[0] : "");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") ?? "");
    const pw2 = String(fd.get("password2") ?? "");
    const sealV = String(fd.get("seal") ?? "");
    if (pw !== pw2) {
      setClientErr("两次输入的密码不一致");
      return;
    }
    if (!/^[\u4e00-\u9fa5]{1,2}$/.test(sealV)) {
      setClientErr("私印需为 1–2 个汉字");
      return;
    }
    setClientErr("");
    fd.delete("password2");
    startTransition(() => formAction(fd));
  };

  const selAv = avatars.find((x) => x.id === avatarId) ?? avatars[0];
  const selBg = backgrounds.find((x) => x.id === bgId) ?? backgrounds[0];

  return (
    <form onSubmit={onSubmit} className="card glass space-y-5 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        <UiText text={"加入慢递局"} />
      </h1>
      <UiInput type="hidden" name="avatarId" value={avatarId} />
      <UiInput type="hidden" name="bgId" value={bgId} />
      <UiInput type="hidden" name="birthday" value={birthday ?? ""} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"邀请码"} />
        </span>
        <UiInput name="code" className="input" placeholder="请输入邀请码" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"邮箱"} />
        </span>
        <UiInput
          name="email"
          type="email"
          className="input"
          placeholder="请输入邮箱"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"笔名"} />
        </span>
        <UiInput
          name="pen"
          className="input"
          placeholder="请输入笔名"
          maxLength={12}
          value={pen}
          onChange={(e) => onPen(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"密码"} />
        </span>
        <div className="relative">
          <UiInput
            name="password"
            type={showPw ? "text" : "password"}
            className="input pr-16"
            placeholder="至少12个字符"
          />
          <EyeToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"确认密码"} />
        </span>
        <div className="relative">
          <UiInput
            name="password2"
            type={showPw2 ? "text" : "password"}
            className="input pr-16"
            placeholder="再次输入密码"
          />
          <EyeToggle shown={showPw2} onToggle={() => setShowPw2(!showPw2)} />
        </div>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"私印"} />
        </span>
        <div className="flex items-center gap-3">
          <UiInput
            name="seal"
            className="input w-28 text-center !text-lg"
            placeholder="印"
            maxLength={2}
            value={seal}
            onChange={(e) => {
              setSealTouched(true);
              setSeal(e.target.value);
            }}
          />
          <Seal char={seal || "印"} size={52} />
        </div>
        <p className="mt-1.5 text-xs text-ink-soft">
          <UiText text={"一至两个汉字，将盖在你寄出的每封信上"} />
        </p>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">
          <UiText text={"生日"} />
        </span>
        <BirthdayPicker value={birthday} onChange={setBirthday} />
      </div>

      <div>
        <span className="mb-2 block text-sm font-semibold">
          <UiText text={"选择小人"} />
        </span>
        <div className="grid grid-cols-6 gap-1.5">
          {avatars.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAvatarId(a.id)}
              className={`aspect-[2/3] overflow-hidden rounded-lg bg-paper2/40 ${
                avatarId === a.id ? "ring-2 ring-vermilion" : ""
              }`}
              title={a.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/assets/${a.file}`}
                alt={a.name}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-semibold">
          <UiText text={"选择背景"} />
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {backgrounds.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBgId(b.id)}
              className={`aspect-[3/2] overflow-hidden rounded-lg bg-paper2/40 ${
                bgId === b.id ? "ring-2 ring-vermilion" : ""
              }`}
              title={b.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/assets/${b.file}`}
                alt={b.name}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl"
          style={{
            backgroundImage: `url(/assets/${selBg.file})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/assets/${selAv.file}`}
            alt="头像预览"
            className="absolute bottom-0 left-1/2 h-[90%] -translate-x-1/2"
          />
        </div>
        <p className="text-xs text-ink-soft">
          <UiText text={"头像预览"} />
          <br />
          {selAv.name}
          <br />
          {selBg.name}
        </p>
      </div>

      {clientErr && <p className="text-sm text-vermilion">{clientErr}</p>}
      {state?.error && (
        <p className="text-sm text-vermilion">
          <UiText text={state.error} />
        </p>
      )}

      <button type="submit" className="btn w-full" disabled={pending}>
        <UiText text={pending ? "…" : "领取笔名与私印"} />
      </button>
      <p className="text-center text-sm text-ink-soft">
        <UiText text={"已经是局里的人了？"} />
        <Link href="/login" className="text-vermilion">
          <UiText text={"登录"} />
        </Link>
      </p>
    </form>
  );
}
