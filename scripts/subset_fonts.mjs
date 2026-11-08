// 用 fonteditor-core 将楷体/仿宋子集化为 woff2（CJK 基本区 + 常用标点 + 语录文字）
import { Font, woff2 } from "fonteditor-core";
import fs from "fs";
import path from "path";

await woff2.init();

const SRC = "C:/Users/ychar/Documents/deepseek-harness/default-workspace/慢递局/tools/fonts_src";
const OUT = "C:/Users/ychar/Documents/deepseek-harness/default-workspace/慢递局/web/public/fonts";
fs.mkdirSync(OUT, { recursive: true });

// 字符集：CJK 基本区 + ASCII + 标点 + 语录
const set = new Set();
for (let c = 0x4e00; c <= 0x9fa5; c++) set.add(c);
for (let c = 0x20; c <= 0x7e; c++) set.add(c);
for (const ch of "，。、；：？！「」『』（）—…·《》〈〉“”‘’－／　") set.add(ch.codePointAt(0));
const quotes = JSON.parse(
  fs.readFileSync("C:/Users/ychar/Documents/deepseek-harness/default-workspace/慢递局/assets/quotes.json", "utf8")
);
for (const q of quotes) for (const ch of q) set.add(ch.codePointAt(0));
const subset = Array.from(set);
console.log("subset chars:", subset.length);

for (const name of ["LXGWWenKai", "ZhuqueFangsong", "NotoSansSC", "NotoSerifSC"]) {
  const ttfPath = path.join(SRC, name + ".ttf");
  if (!fs.existsSync(ttfPath)) {
    console.log(name, "missing, skip");
    continue;
  }
  const buf = fs.readFileSync(ttfPath);
  const font = Font.create(buf, { type: "ttf", hinting: false, subset });
  const woff2 = font.write({ type: "woff2" });
  const outPath = path.join(OUT, name + "-subset.woff2");
  fs.writeFileSync(outPath, woff2);
  console.log(name, "->", woff2.length, "bytes");
}
console.log("DONE");
