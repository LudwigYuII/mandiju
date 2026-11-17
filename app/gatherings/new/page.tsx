import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SITE_TIME_ZONE } from "@/lib/time";
import { UiText, UiInput, UiTextarea } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
export const dynamic = "force-dynamic";
export default async function NewGathering() {
  await waitDb();
  const s = await getSession();
  if (!s) redirect("/login");
  const me = (
    await db.execute({
      sql: "SELECT literary_name FROM users WHERE id=?",
      args: [s.uid],
    })
  ).rows[0];
  if (!me?.literary_name) redirect("/identity");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-ink-soft">
          <UiText text="不必即时作答，相约从容留文" />
        </p>
        <h1 className="text-3xl">
          <UiText text="设一席雅集" />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText text="小范围谈一个主题。时间、范围和受邀名单题定后保持不变；默认私席，散席后的集序沿用原范围。" />
        </p>
      </header>
      <LiteraryForm
        gathering
        op="create"
        fields={{ send_key: crypto.randomUUID() }}
        draftKey={`${s.uid}:new-gathering`}
        label="题定雅集"
      >
        <section className="card space-y-5 p-6">
          <label className="block space-y-2">
            <span>
              <UiText text="主题（最多八十字）" />
            </span>
            <UiInput
              className="input w-full"
              name="title"
              required
              maxLength={80}
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="简介（选填，最多一千字）" />
            </span>
            <UiTextarea
              className="input w-full"
              name="intro"
              rows={4}
              maxLength={1000}
            />
          </label>
          <p className="text-sm leading-loose text-ink-soft">
            <UiText text="以下时间均按公共活动时区填写：" />
            {SITE_TIME_ZONE}
            <UiText text="。未来一年内开始，最长七日。" />
          </p>
          <label className="block space-y-2">
            <span>
              <UiText text="开始时间" />
            </span>
            <UiInput
              className="input w-full min-w-0"
              type="datetime-local"
              name="starts_at"
              required
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="结束时间" />
            </span>
            <UiInput
              className="input w-full min-w-0"
              type="datetime-local"
              name="ends_at"
              required
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="席位上限（含主人，二至二十四人）" />
            </span>
            <UiInput
              className="input w-full"
              name="capacity"
              type="number"
              min={2}
              max={24}
              defaultValue="12"
              required
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="雅集与集序的可见范围" />
            </span>
            <select
              name="visibility"
              className="input w-full"
              defaultValue="private"
            >
              <option value="private">
                <UiText text="私席：主人与受邀入席者" />
              </option>
              <option value="public">
                <UiText text="公开席：所有访客可读，登录后可入席" />
              </option>
            </select>
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="受邀笔友雅号（选填，用逗号分开）" />
            </span>
            <UiInput className="input w-full" name="invitees" maxLength={500} />
          </label>
          <p className="text-sm leading-loose text-ink-soft">
            <UiText text="受邀席位会预留，含主人在上限内。仅邀请已有笔友或已收到其来信的书友；可婉谢。私席留空则仅自己可见。" />
          </p>
          <label className="flex items-start gap-3">
            <UiInput name="consent" type="checkbox" required />
            <UiText text="确认按所选范围展示主题、简介、活动时间与主人雅号，并保留为集序题头；我的雅号在席间展示。其他人的私信不会纳入。" />
          </label>
          <label className="flex items-start gap-3">
            <UiInput name="archive" type="checkbox" />
            <UiText text="另同意将我的雅号列入集序出席名录（选填，可撤回）。每篇文字另行选择是否归档。" />
          </label>
        </section>
      </LiteraryForm>
    </div>
  );
}
