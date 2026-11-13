"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState, useRef, useState } from "react";
import {
  updateProfileAction,
  updateUploadAvatarAction,
  type ActionState,
} from "@/lib/actions";
import Avatar from "./Avatar";

type Av = { id: string; name: string; file: string };
type Bg = { id: string; name: string; file: string };

export default function ProfileAvatarEditor({
  pen,
  currentAvatar,
  currentBg,
  avatars,
  backgrounds,
}: {
  pen: string;
  currentAvatar: string;
  currentBg: string;
  avatars: Av[];
  backgrounds: Bg[];
}) {
  const [avatarId, setAvatarId] = useState(
    currentAvatar.startsWith("upload:") ? "C01" : currentAvatar,
  );
  const [bgId, setBgId] = useState(currentBg);
  const [uploadUrl, setUploadUrl] = useState(
    currentAvatar.startsWith("upload:") ? currentAvatar.slice(7) : "",
  );
  const [uploading, setUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [bgErr, setBgErr] = useState("");
  const [profileState, profileAction, profilePending] = useActionState<
    ActionState,
    FormData
  >(updateProfileAction, {});
  const [uploadState, uploadAction, uploadPending] = useActionState<
    ActionState,
    FormData
  >(updateUploadAvatarAction, {});
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const upload = async (f: File, kind: "avatar" | "bg") => {
    const setBusy = kind === "avatar" ? setUploading : setBgUploading;
    const setErr = kind === "avatar" ? setUploadErr : setBgErr;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("purpose", "profile");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "上传失败");
        return;
      }
      if (kind === "avatar") setUploadUrl(j.url);
      else setBgId(`upload:${j.url}`);
    } catch {
      setErr("上传失败");
    } finally {
      setBusy(false);
    }
  };

  const usingUploadedBg = bgId.startsWith("upload:");

  return (
    <div className="space-y-5">
      {/* 当前头像 + 上传整图 */}
      <div className="flex items-center gap-4">
        <Avatar pen={pen} avatarId={currentAvatar} bgId={currentBg} size={64} />
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost"
            disabled={uploading}
          >
            <UiText text={uploading ? "上传中…" : "上传整图头像"} />
          </button>
          <UiInput
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, "avatar");
            }}
          />
          {uploadUrl && (
            <form action={uploadAction} className="mt-2">
              <UiInput type="hidden" name="upload" value={uploadUrl} />
              <button
                className="btn !px-4 !py-2 !text-sm"
                disabled={uploadPending}
              >
                <UiText text={"使用上传图"} />
              </button>
            </form>
          )}
          {uploadErr && (
            <p className="mt-1 text-xs text-vermilion">{uploadErr}</p>
          )}
          {uploadState?.ok && (
            <p className="mt-1 text-xs text-postblue">
              <UiText text={"已设为头像"} />
            </p>
          )}
          <p className="mt-1 text-xs text-ink-soft">
            <UiText text={"JPG/PNG/WebP，不超过 5MB；整图头像不叠小人"} />
          </p>
        </div>
      </div>

      {/* 官方小人 + 背景组合 */}
      <form
        action={profileAction}
        className="space-y-3 border-t border-black/5 pt-4 dark:border-white/10"
      >
        <UiInput type="hidden" name="avatarId" value={avatarId} />
        <UiInput type="hidden" name="bgId" value={bgId} />

        <div className="flex items-center gap-4 rounded-xl bg-paper2/40 p-3">
          <Avatar
            pen={pen}
            avatarId={avatarId}
            bgId={bgId}
            size={72}
            className="ring-1 ring-black/5"
          />
          <div className="text-xs leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">
              <UiText text={"身份预览"} />
            </p>
            <p>
              <UiText text={"官方小人 +"} />
              <UiText
                text={
                  usingUploadedBg ? "你上传的背景（毛玻璃雾化）" : "官方背景"
                }
              />
              <UiText text={"， 会出现在页头、书房题签与信件落款处。"} />
            </p>
          </div>
        </div>

        <p className="text-xs font-semibold text-ink-soft">
          <UiText text={"官方小人"} />
        </p>
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

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-ink-soft">
            <UiText text={"背景"} />
          </p>
          <button
            type="button"
            onClick={() => bgFileRef.current?.click()}
            className="text-xs text-vermilion hover:underline"
            disabled={bgUploading}
          >
            <UiText
              text={bgUploading ? "上传中…" : "上传自定义背景（毛玻璃）"}
            />
          </button>
          <UiInput
            ref={bgFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, "bg");
            }}
          />
        </div>
        {bgErr && <p className="text-xs text-vermilion">{bgErr}</p>}
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
        {usingUploadedBg && (
          <p className="text-xs text-ink-soft">
            <UiText text={"自定义背景已选中；点任一官方背景即可切回。"} />
          </p>
        )}

        <button className="btn !px-4 !py-2 !text-sm" disabled={profilePending}>
          <UiText text={"保存身份"} />
        </button>
        {profileState?.ok && (
          <p className="text-xs text-postblue">
            <UiText text={"已更新"} />
          </p>
        )}
        {profileState?.error && (
          <p className="text-xs text-vermilion">
            <UiText text={profileState.error} />
          </p>
        )}
      </form>
    </div>
  );
}
