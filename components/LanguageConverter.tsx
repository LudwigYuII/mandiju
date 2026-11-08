"use client";

import { useEffect } from "react";

const SKIP_SEL = "input, textarea, select, script, style, [data-no-convert]";

function isSkip(node: Node): boolean {
  const el = node.parentElement;
  if (!el) return false;
  return el.closest(SKIP_SEL) !== null;
}

/** 简繁转换：繁体模式下对全站文本（含用户内容）做 DOM 级转换 + 动态内容监听 */
export default function LanguageConverter() {
  useEffect(() => {
    let enabled = false;
    try {
      enabled = localStorage.getItem("mdj-trad") === "1";
    } catch {}
    if (!enabled) return;

    let conv: ((s: string) => string) | null = null;
    let mo: MutationObserver | null = null;

    const convertNode = (n: Node) => {
      if (!conv) return;
      if (isSkip(n)) return;
      const t = n.textContent;
      if (!t || !t.trim()) return;
      const el = n.parentElement;
      if (el && el.dataset.converted) return;
      const out = conv(t);
      if (out !== t) {
        if (el) el.dataset.converted = "1";
        n.textContent = out;
      }
    };

    const convertTree = (root: ParentNode) => {
      if (!conv) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) convertNode(n);
    };

    (async () => {
      try {
        const opencc = await import("opencc-js");
        conv = opencc.Converter({ from: "cn", to: "tw" });
        convertTree(document.body);
        mo = new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type === "characterData") {
              convertNode(m.target);
            } else {
              m.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) convertNode(node);
                else if (node.nodeType === Node.ELEMENT_NODE) convertTree(node as ParentNode);
              });
            }
          }
        });
        mo.observe(document.body, { subtree: true, childList: true, characterData: true });
      } catch (e) {
        console.error("[opencc] failed:", e);
      }
    })();

    return () => {
      mo?.disconnect();
    };
  }, []);

  return null;
}
