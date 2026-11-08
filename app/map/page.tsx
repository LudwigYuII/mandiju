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
          WHERE city IS NOT NULL AND city != '' AND (author_id = ? OR recipient_id = ?)
          GROUP BY city ORDER BY n DESC`,
    args: [sess.uid, sess.uid],
  });

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">城市邮戳地图</h1>
      <Reveal>
        <section className="card glass p-5">
          <p className="text-sm text-ink-soft">
            你寄出和收到的信，盖过戳的城市都会点亮。
            共点亮 {cities.rows.length} 座城市。
          </p>
          <div className="mt-4">
            <CityMap
              data={cities.rows.map((r: any) => ({ city: String(r.city), count: Number(r.n) }))}
            />
          </div>
        </section>
      </Reveal>
    </div>
  );
}
