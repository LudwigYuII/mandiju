import fs from "fs";
import path from "path";
import Reveal from "@/components/Reveal";

const RELEASES_URL = "https://github.com/LudwigYuII/mandiju/releases";
const LATEST_URL = `${RELEASES_URL}/latest/download`;
const SETUP_URL = `${LATEST_URL}/mandiju-setup.exe`;
const PORTABLE_URL = `${LATEST_URL}/mandiju-portable.exe`;

const APP_VERSION = "v1.8.0";

/** 读取仓库内 APK 的体积与构建日期（Vercel 构建时 public/ 已在产物里） */
function readApkInfo() {
  try {
    const p = path.join(process.cwd(), "public", "downloads", "mandiju.apk");
    const st = fs.statSync(p);
    const date = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(st.mtime);
    return {
      size: `${(st.size / 1024 / 1024).toFixed(1)} MB`,
      date,
    };
  } catch {
    return { size: "", date: "" };
  }
}

export default function DownloadPage() {
  const apk = readApkInfo();
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">下载</h1>
      <p className="-mt-3 text-sm text-ink-soft">
        当前版本 {APP_VERSION} · 安装包由 GitHub Actions 自动构建，与线上站点同源。
      </p>

      <Reveal>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">📱 安卓 App</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            独立安卓安装包，把慢递局装进口袋。安装后同样支持来信推送与全屏体验。
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a href="/downloads/mandiju.apk" className="btn !px-6 !py-2.5 !text-sm" download>
              下载安卓安装包
            </a>
            <span className="text-xs text-ink-soft">
              mandiju.apk{apk.size ? ` · ${apk.size}` : ""}
              {apk.date ? ` · 构建于 ${apk.date}` : ""}
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            安装说明：下载完成后打开文件，若提示「未知来源应用」，请在系统设置 →
            安全（或应用管理）中允许「安装未知来源应用」，再继续安装即可。
          </p>

          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">关于签名：</span>
            本站 APK 使用调试签名（debug key），不是应用商店版本。若你装过更早的安装包，
            由于先后两次构建的签名可能不同，直接覆盖安装会失败 ——
            请先卸载旧版本，再安装新下载的文件（聊天记录与信件都在服务器上，不受影响）。
          </div>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">💻 Windows 桌面</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            两种装法任选：独立安装包（开始菜单 + 桌面快捷方式），或免安装的便携版。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={SETUP_URL}
              className="btn !px-6 !py-2.5 !text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              下载安装版 .exe
            </a>
            <a
              href={PORTABLE_URL}
              className="btn-ghost !px-5 !py-2.5 !text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              下载便携版 .exe
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-vermilion hover:underline"
            >
              查看全部版本（GitHub Releases）
            </a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            桌面版是加载线上站点的轻量外壳，体积小、随站点自动更新；如果只是想在电脑上用，
            也可以直接装 PWA（见下方指引），效果相同、无需下载安装包。
          </p>
        </section>
      </Reveal>

      <Reveal delay={160}>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">🧩 PWA 安装指引</h2>
          <ol className="mt-3 space-y-3 text-sm leading-relaxed">
            <li className="flex gap-2.5">
              <span className="shrink-0 font-semibold text-vermilion">1</span>
              <span>
                <span className="font-semibold">Android Chrome：</span>
                <span className="text-ink-soft">
                  打开菜单（⋮）→「安装应用」或「添加到主屏幕」，确认后桌面上就有慢递局。
                </span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0 font-semibold text-vermilion">2</span>
              <span>
                <span className="font-semibold">iOS Safari：</span>
                <span className="text-ink-soft">
                  点击底部分享按钮 →「添加到主屏幕」，之后从主屏幕图标打开即为全屏 App。
                  注意：iOS 需以此方式安装后才支持来信推送。
                </span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0 font-semibold text-vermilion">3</span>
              <span>
                <span className="font-semibold">Windows Edge：</span>
                <span className="text-ink-soft">
                  打开本站后，点击地址栏右侧的「安装应用」图标，按提示完成安装。
                </span>
              </span>
            </li>
          </ol>
          <p className="mt-4 border-t border-black/5 pt-3 text-xs text-ink-soft dark:border-white/10">
            版本变化见 <a href="/changelog" className="text-vermilion hover:underline">更新日志</a>。
          </p>
        </section>
      </Reveal>
    </div>
  );
}
