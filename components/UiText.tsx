"use client";
import { forwardRef } from "react";
import { useLanguage } from "./LanguageProvider";
import hant from "@/data/ui.zh-Hant.json";
function translate(text: unknown, locale: string) {
  return locale === "zh-Hant" && typeof text === "string"
    ? ((hant as Record<string, string>)[text] ?? text)
    : text;
}
/** Only explicitly authored UI copy is translated. User-authored values are never passed here implicitly. */
export function UiText({ text }: { text: unknown }) {
  const { locale } = useLanguage();
  return <>{translate(text, locale) as React.ReactNode}</>;
}
export const UiInput = forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input">
>(function UiInput(props, ref) {
  const { locale } = useLanguage();
  return (
    <input
      {...props}
      ref={ref}
      placeholder={translate(props.placeholder, locale) as string}
      title={translate(props.title, locale) as string}
      aria-label={translate(props["aria-label"], locale) as string}
    />
  );
});
export const UiTextarea = forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea">
>(function UiTextarea(props, ref) {
  const { locale } = useLanguage();
  return (
    <textarea
      {...props}
      ref={ref}
      placeholder={translate(props.placeholder, locale) as string}
      title={translate(props.title, locale) as string}
      aria-label={translate(props["aria-label"], locale) as string}
    />
  );
});
