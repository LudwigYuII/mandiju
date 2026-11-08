import ResetForm from "./ResetForm";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-sm pt-8">
      <ResetForm email={email} />
    </div>
  );
}
