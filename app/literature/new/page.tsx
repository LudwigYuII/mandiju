import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UiText, UiInput, UiTextarea } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
export const dynamic = "force-dynamic";
export default async function NewScroll() {
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
          <UiText text="一人起首，诸友相和" />
        </p>
        <h1 className="text-3xl">
          <UiText text="起一卷唱和" />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText text="诗词、现代诗与自由创作皆可。韵脚只作提示，不检查格律。每位书友在同卷留一篇，依序展读。" />
        </p>
      </header>
      <LiteraryForm
        op="create"
        fields={{ send_key: crypto.randomUUID() }}
        draftKey={`${s.uid}:new-scroll`}
        label="题定此卷"
      >
        <section className="card space-y-5 p-6">
          <label className="block space-y-2">
            <span>
              <UiText text="卷名（最多八十字）" />
            </span>
            <UiInput
              name="title"
              required
              maxLength={80}
              className="input w-full"
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="小序（选填，最多一千字）" />
            </span>
            <UiTextarea name="intro" rows={3} className="input w-full" />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="参与上限（含起首者，二至二十四人）" />
            </span>
            <UiInput
              name="capacity"
              type="number"
              defaultValue="12"
              min={2}
              max={24}
              required
              className="input w-full"
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="可见范围（题定后保持不变）" />
            </span>
            <select
              name="visibility"
              defaultValue="private"
              className="input w-full"
            >
              <option value="private">
                <UiText text="私卷：仅起首者和受邀入卷者" />
              </option>
              <option value="public">
                <UiText text="公开卷：所有访客可阅读，登录后可入卷" />
              </option>
            </select>
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="受邀笔友雅号（选填，用逗号分开）" />
            </span>
            <UiInput name="invitees" className="input w-full" />
          </label>
          <p className="text-sm leading-loose text-ink-soft">
            <UiText text="私卷的受邀名单在起卷时题定，受邀者入卷后可阅读全卷。留空则仅自己可见；唱和卷页可查看收到的卷邀。" />
          </p>
        </section>
        <section className="card space-y-5 p-6">
          <h2 className="text-xl">
            <UiText text="起首之作" />
          </h2>
          <label className="block space-y-2">
            <span>
              <UiText text="篇名（选填，留空沿用卷名）" />
            </span>
            <UiInput
              name="work_title"
              maxLength={80}
              className="input w-full"
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="正文（最多一万字）" />
            </span>
            <UiTextarea
              name="body"
              required
              rows={12}
              className="input w-full"
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="韵脚提示（选填）" />
            </span>
            <UiInput name="rhyme" maxLength={100} className="input w-full" />
          </label>
          <p className="text-sm leading-loose text-ink-soft">
            <UiText text="自注写法：[[词语|解释或出处]]。原文保存，点击或键盘聚焦词语即可展读注释。" />
          </p>
          <label className="flex gap-3">
            <UiInput name="vertical" type="checkbox" />
            <UiText text="此篇使用直排阅读" />
          </label>
          <label className="flex items-start gap-3">
            <UiInput name="consent" type="checkbox" required />
            <UiText text="我确认按所选范围展示本卷及我的作品；作品和雅号将随卷展示，其他人的私信不会被纳入。" />
          </label>
        </section>
      </LiteraryForm>
    </div>
  );
}
