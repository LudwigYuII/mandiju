import manifest from "@/data/manifest.json";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md pt-8">
      <RegisterForm
        avatars={manifest.avatars as any[]}
        backgrounds={manifest.backgrounds as any[]}
      />
    </div>
  );
}
