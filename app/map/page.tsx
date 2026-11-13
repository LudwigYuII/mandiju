import { UiText } from "@/components/UiText";

import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Reveal from "@/components/Reveal";
import CityMap from "@/components/CityMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");

  const cities = await db.execute({
    sql: `SELECT city, COUNT(*) AS n FROM letters
          WHERE city IS NOT NULL AND city != '' AND (author_id = ? OR (recipient_id = ? AND deliver_at <= ?))
          GROUP BY city ORDER BY n DESC`,
    args: [sess.uid, sess.uid, Date.now()],
  });

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">
        <UiText text={"往来地名"} />
      </h1>
      <Reveal>
        <section className="card glass p-5">
          <p className="text-sm text-ink-soft">
            <UiText
              text={"来自你已寄出或已收到的信，地点由作者自愿填写。 共点亮"}
            />
            {cities.rows.length}
            <UiText text={"座城市。"} />
          </p>
          <div className="mt-4">
            <CityMap
              data={cities.rows.map((r: any) => ({
                city: String(r.city),
                count: Number(r.n),
              }))}
            />
          </div>
        </section>
      </Reveal>
    </div>
  );
}
