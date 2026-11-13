"use client";
import { UiText } from "@/components/UiText";

import { useEffect, useState } from "react";

type PushState = "loading" | "unsupported" | "denied" | "off" | "on" | "busy";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buf = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buf);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const LABELS: Record<PushState, string> = {
  loading: "读取中…",
  unsupported: "此浏览器不支持",
  denied: "通知已被拒绝",
  off: "开启来信推送",
  on: "已开启 · 点按取消",
  busy: "处理中…",
};

export default function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [hint, setHint] = useState("");

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState("unsupported");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  async function toggle() {
    if (state === "busy" || state === "loading" || state === "unsupported")
      return;
    setHint("");

    if (state === "denied") {
      setHint(
        "浏览器已拒绝本站通知。请在地址栏的通知/网站设置里重新允许，再回来开启。",
      );
      return;
    }

    // 已开启 → 取消订阅
    if (state === "on") {
      setState("busy");
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setState("off");
      } catch (e) {
        console.error(e);
        setHint("取消失败，请稍后再试。");
        setState("on");
      }
      return;
    }

    // 未开启 → 请求权限并订阅
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        setHint("浏览器未授予通知权限，无法开启推送。");
        return;
      }
      const keyRes = await fetch("/api/push/key");
      const keyData = (await keyRes.json()) as { publicKey?: string };
      const publicKey = String(keyData?.publicKey || "");
      if (!publicKey) {
        setState("off");
        setHint("站长还没配置推送密钥，过几天再来试试。");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("on");
    } catch (e) {
      console.error(e);
      setState("off");
      setHint("开启失败，请稍后再试。");
    }
  }

  const disabled =
    state === "busy" || state === "loading" || state === "unsupported";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <UiText text={"🔔 来信推送"} />
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            <UiText text={"开启后，新信送达会锁屏提醒"} />
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          className={`btn-ghost shrink-0 !text-sm ${
            state === "on" ? "!border-vermilion !text-vermilion" : ""
          }`}
        >
          {LABELS[state]}
        </button>
      </div>
      {hint && <p className="text-xs text-vermilion">{hint}</p>}
      {!hint && state === "unsupported" && (
        <p className="text-xs text-ink-soft">
          <UiText
            text={
              "此浏览器暂不支持 Web Push。iOS 需先把本站添加到主屏幕并安装为 App 后才支持。"
            }
          />
        </p>
      )}
    </div>
  );
}
