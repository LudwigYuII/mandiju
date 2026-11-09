import Reveal from "@/components/Reveal";

export default function DownloadPage() {
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">下载</h1>

      <Reveal>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">📱 安卓 App</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            独立安卓安装包，把慢递局装进口袋。安装后同样支持来信推送与全屏体验。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/downloads/mandiju.apk"
              className="btn !px-6 !py-2.5 !text-sm"
              download
            >
              下载安卓安装包
            </a>
            <span className="text-xs text-ink-soft">mandiju.apk</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            安装说明：下载完成后打开文件，若提示「未知来源应用」，请在系统设置 →
            安全（或应用管理）中允许「安装未知来源应用」，再继续安装即可。
          </p>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">💻 Windows 桌面</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            推荐直接用浏览器安装 PWA：Edge / Chrome 打开本站后，点击地址栏右侧的
            「安装应用」图标即可把慢递局装成桌面应用，轻量、自动更新。
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
            独立安装包由站长在 GitHub Releases 分发，见{" "}
            <a
              href="https://github.com/LudwigYuII/mandiju/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-vermilion hover:underline"
            >
              github.com/LudwigYuII/mandiju/releases
            </a>
            。
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
        </section>
      </Reveal>
    </div>
  );
}
