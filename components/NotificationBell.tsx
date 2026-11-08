"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/notifications/count")
      .then((r) => r.json())
      .then((j) => {
        if (alive) setCount(j.count ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <Link href="/notifications" aria-label="通知" className="relative text-lg">
      🔔
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-vermilion px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
