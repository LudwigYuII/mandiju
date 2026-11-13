"use client";
import { UiText } from "@/components/UiText";

import { logoutAction } from "@/lib/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className="btn-ghost">
        <UiText text={"退出登录"} />
      </button>
    </form>
  );
}
