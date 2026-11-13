import { UiText } from "@/components/UiText";

import Link from "next/link";
import { redirect } from "next/navigation";
import { waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function YearPage() {
  await waitDb();
  if (!(await getSession())) redirect("/login");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">
        <UiText text={"旧笺回望"} />
      </h1>
      <p className="leading-loose text-ink-soft">
        <UiText
          text={
            "往来不必用封数、字数或成就衡量。你可以回到信匣，重读那些想念的文字。"
          }
        />
      </p>
      <Link className="btn-ghost" href="/mail">
        <UiText text={"重读旧笺"} />
      </Link>
    </div>
  );
}
