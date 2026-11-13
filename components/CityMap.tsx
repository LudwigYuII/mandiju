import { UiText } from "./UiText";
/** Global, location-optional fallback. No geographic inference or activity-size markers. */
export default function CityMap({
  data,
}: {
  data: { city: string; count: number }[];
}) {
  const cities = [...new Set(data.map((row) => row.city))].sort((a, b) =>
    a.localeCompare(b),
  );
  return (
    <div>
      <p className="text-sm leading-loose text-ink-soft">
        <UiText text="这些地名来自双方主动填写的邮戳，不代表真实所在地。" />
      </p>
      <ul className="mt-6 flex flex-wrap gap-4">
        {cities.map((city) => (
          <li
            className="border-b border-black/10 px-2 py-3 dark:border-white/10"
            key={city}
          >
            {city}
          </li>
        ))}
      </ul>
    </div>
  );
}
