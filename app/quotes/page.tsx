import { UiText } from "@/components/UiText";

import quotes from "@/data/quotes.json";
import Reveal from "@/components/Reveal";
import QuotesLibrary from "@/components/QuotesLibrary";

export const dynamic = "force-dynamic";

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">
        <UiText text={"小笺库"} />
      </h1>
      <Reveal>
        <QuotesLibrary quotes={quotes} />
      </Reveal>
    </div>
  );
}
