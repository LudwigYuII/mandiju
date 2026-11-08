"use client";

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
  const [avatarId, setAvatarId] = useState(currentAvatar.startsWith("upload:") ? "C01" : currentAvatar);
  const [bgId, setBgId] = useState(currentBg);
  const [uploadUrl, setUploadUrl] = useState(
    currentAvatar.startsWith("upload:") ? currentAvatar.slice(7) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    {}
  );
  const [uploadState, uploadAction, uploadPending] = useActionState<ActionState, FormData>(
    updateUploadAvatarAction,
    {}
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File) => {
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
      setUploadUrl(j.url);
    } catch {
      setUploadErr("上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 当前头像 + 上传 */}
      <div className="flex items-center gap-4">
        <Avatar pen={pen} avatarId={currentAvatar} bgId={currentBg} size={64} />
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost"
            disabled={uploading}
          >
            {uploading ? "上传中…" : "上传图片"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
            }}
          />
          {uploadUrl && (
            <form action={uploadAction} className="mt-2">
              <input type="hidden" name="upload" value={uploadUrl} />
              <button className="btn !px-4 !py-2 !text-sm" disabled={uploadPending}>
                使用上传图
              </button>
            </form>
          )}
          {uploadErr && <p className="mt-1 text-xs text-vermilion">{uploadErr}</p>}
          {uploadState?.ok && <p className="mt-1 text-xs text-postblue">已设为头像</p>}
          <p className="mt-1 text-xs text-ink-soft">JPG/PNG/WebP，不超过 5MB</p>
        </div>
      </div>

      {/* 官方小人 */}
      <form action={profileAction} className="space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
        <input type="hidden" name="avatarId" value={avatarId} />
        <input type="hidden" name="bgId" value={bgId} />
        <p className="text-xs font-semibold text-ink-soft">官方小人</p>
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
              <img src={`/assets/${a.file}`} alt={a.name} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-ink-soft">背景</p>
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
              <img src={`/assets/${b.file}`} alt={b.name} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
        <button className="btn !px-4 !py-2 !text-sm" disabled={profilePending}>
          使用官方头像
        </button>
        {profileState?.ok && <p className="text-xs text-postblue">已更新</p>}
      </form>
    </div>
  );
}
