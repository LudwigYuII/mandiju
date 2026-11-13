global.React = require("react");
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { calendarEvents } = require("../lib/calendar-core.ts");
const { siteDateKey, siteDateStart } = require("../lib/time.ts");
const { validBirthday } = require("../lib/profile-policy.ts");
const LanguageProvider = require("../components/LanguageProvider.tsx").default;
const { UiText } = require("../components/UiText.tsx");
test("public date is UTC+08 across UTC midnight and year boundaries", () => {
  assert.equal(siteDateKey(new Date("2026-12-31T16:01:00Z")), "2027-01-01");
  assert.equal(siteDateKey(new Date("2026-12-31T15:59:00Z")), "2026-12-31");
});
test("lunar festivals are calculated for their year instead of repeating the 2026 table", () => {
  assert.ok(
    calendarEvents(new Date("2026-02-17T04:00:00Z")).some(
      (e) => e.name === "春节",
    ),
  );
  assert.ok(
    calendarEvents(new Date("2027-02-06T04:00:00Z")).some(
      (e) => e.name === "春节",
    ),
  );
  assert.ok(
    !calendarEvents(new Date("2027-02-17T04:00:00Z")).some(
      (e) => e.name === "春节",
    ),
  );
});
test("birthday input accepts month/day and leap day but rejects invalid dates", () => {
  assert.equal(validBirthday("02-29"), true);
  assert.equal(validBirthday("2023-02-29"), false);
  assert.equal(validBirthday("04-31"), false);
  assert.equal(validBirthday("12-15"), true);
});
test("traditional UI does not convert original authored content", () => {
  const original = "汉语原文：这是我的书信。";
  const markup = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLocale: "zh-Hant" },
      React.createElement(UiText, { text: "写一封信" }),
      React.createElement("p", null, original),
    ),
  );
  assert.ok(markup.includes("寫一封信"));
  assert.ok(markup.includes(original));
});

test("date-only scheduling is explicit and invalid dates are rejected", () => {
  assert.equal(siteDateStart("2027-01-01"), Date.parse("2026-12-31T16:00:00Z"));
  assert.equal(siteDateStart("2027-02-30"), null);
});
const { validPushEndpoint } = require("../lib/push-policy.ts");
test("push endpoint cannot point at arbitrary external or local hosts", () => {
  assert.equal(
    validPushEndpoint("https://fcm.googleapis.com/push/token"),
    true,
  );
  for (const value of [
    "https://localhost/a",
    "https://127.0.0.1/a",
    "https://example.test/a",
    "https://fcm.googleapis.com.attacker.test/a",
    "http://fcm.googleapis.com/a",
  ])
    assert.equal(validPushEndpoint(value), false);
});
