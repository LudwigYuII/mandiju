import { UiText } from "@/components/UiText";

import Link from "next/link";
import Seal from "./Seal";
import NotificationBell from "./NotificationBell";

export default function Header() {
  return (
    <header className="glass sticky top-0 z-40 border-b border-black/5 dark:border-white/10">
      <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Seal char="慢" size={32} />
          <span className="text-lg font-semibold tracking-widest">
            <UiText text={"慢递局"} />
          </span>
        </Link>
        <nav className="flex w-full flex-wrap items-center gap-4 text-sm text-ink-soft sm:w-auto">
          <Link href="/write" className="btn !px-4 !py-1.5 !text-sm">
            <UiText text={"写信"} />
          </Link>
          <Link href="/topics" className="hover:text-ink">
            <UiText text={"同题"} />
          </Link>
          <Link href="/friends" className="hover:text-ink">
            <UiText text={"笔友"} />
          </Link>
          <Link href="/stamps" className="hover:text-ink">
            <UiText text={"邮票册"} />
          </Link>
          <NotificationBell />
          <Link
            href="/settings"
            aria-label="设置"
            className="text-lg transition-transform hover:rotate-45"
          >
            ⚙️
          </Link>
        </nav>
      </div>
    </header>
  );
}
