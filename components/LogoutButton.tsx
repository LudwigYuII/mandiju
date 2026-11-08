"use client";

import { logoutAction } from "@/lib/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className="btn-ghost">退出登录</button>
    </form>
  );
}
