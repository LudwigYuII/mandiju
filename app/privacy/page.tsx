import { UiText } from "@/components/UiText";

import Link from "next/link";
export default function Privacy() {
  return (
    <article className="prose-letter mx-auto space-y-6">
      <h1 className="text-3xl">
        <UiText text={"隐私与内容权利"} />
      </h1>
      <p>
        <UiText
          text={
            "私人信件、草稿与关系默认受到保护。公开作品需要主动选择；公开不意味着授权本站另行出版、修改或商业使用。"
          }
        />
      </p>
      <h2>
        <UiText text={"收集与存储"} />
      </h2>
      <p>
        <UiText
          text={
            "账号使用邮箱、笔名与密码哈希。生辰、头像及文学化地名均可自愿提供，不要求真实姓名、出生年份或真实住址。"
          }
        />
      </p>
      <p>
        <UiText
          text={
            "部署可使用数据库及对象存储服务。启用邮件或推送时，相关服务会处理必要的收件地址或订阅资料。邮件通知默认关闭，用户可在设置中开启；来信提醒不含私人标题、正文或阅读状态。"
          }
        />
      </p>
      <h2>
        <UiText text={"访问与备份"} />
      </h2>
      <p>
        <UiText
          text={
            "私信仅在送达后向收件人开放。本站不会向寄件人提供已读回执。后台治理应遵循必要权限与审计；备份需要加密，附件需要单独保护与恢复核验。"
          }
        />
      </p>
      <h2>
        <UiText text={"你的选择"} />
      </h2>
      <p>
        <UiText
          text={
            "界面简繁切换不修改作品原文。你可以管理通知、保留私人副本；如需注销、撤回公开授权或处理个人数据，请联系站长。涉及双方书信和共同作品，会先说明保留与删除范围，不承诺未经核实的“全部彻底删除”。"
          }
        />
      </p>
      <Link href="mailto:ycharsenal@163.com" className="btn-ghost">
        <UiText text={"联系站长处理隐私事项"} />
      </Link>
    </article>
  );
}
