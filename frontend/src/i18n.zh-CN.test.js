import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const englishPath = path.join(
  projectRoot,
  "public/locales/en/translation.json"
);
const chinesePath = path.join(
  projectRoot,
  "public/locales/zh-CN/translation.json"
);

const flatten = (value, prefix = "") =>
  Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flatten(child, fullKey)
      : [[fullKey, child]];
  });

const placeholders = (value) =>
  [...String(value).matchAll(/{{\s*[^}]+\s*}}/g)]
    .map(([token]) => token)
    .sort();

describe("Simplified Chinese localization", () => {
  test("registers Simplified Chinese in i18n and the language selector", () => {
    const i18nSource = fs.readFileSync(path.join(projectRoot, "src/i18n.js"), "utf8");
    const selectorSource = fs.readFileSync(
      path.join(projectRoot, "src/components/pdf/SelectLanguage.jsx"),
      "utf8"
    );

    assert.ok(i18nSource.includes('"zh-CN"'));
    assert.ok(
      selectorSource.includes('{ value: "zh-CN", text: "简体中文" }')
    );
  });

  test("provides every English translation key with intact placeholders", () => {
    assert.ok(fs.existsSync(chinesePath));

    const english = flatten(JSON.parse(fs.readFileSync(englishPath, "utf8")));
    const chinese = new Map(
      flatten(JSON.parse(fs.readFileSync(chinesePath, "utf8")))
    );

    assert.equal(chinese.size, english.length);
    for (const [key, englishValue] of english) {
      assert.ok(chinese.has(key), `missing translation key: ${key}`);
      assert.notEqual(
        String(chinese.get(key)).trim(),
        "",
        `empty translation: ${key}`
      );
      assert.deepEqual(
        placeholders(chinese.get(key)),
        placeholders(englishValue),
        `placeholder mismatch: ${key}`
      );
    }
  });

  test("uses reviewed signing terminology without pathological repetition", () => {
    const chinese = JSON.parse(fs.readFileSync(chinesePath, "utf8"));
    const expectedTerms = [
      [chinese["sort-order"].Ascending, "升序"],
      [chinese["sort-order"].Descending, "降序"],
      [chinese["sort-order"].Date, "日期"],
      [chinese.pdf, "PDF"],
      [chinese.action, "操作"],
      [chinese.of, "共"],
      [chinese.term, "服务条款"],
      [chinese["signup-page"], "注册页面"],
      [chinese.btnLabel.sign, "签署"],
      [chinese.folder, "文件夹"],
      [chinese.docs, "文档"],
      [chinese.pro, "专业版"],
      [chinese["public-profile"], "公开资料"],
      [chinese.sidebar["OpenSign™ Drive"], "{{appName}} 云盘"],
      [chinese.sidebar["Documents-Children"]["Need your sign"], "待我签署"],
      [chinese.btnLabel.Sign, "签署"],
      [chinese.btnLabel.View, "查看"],
      [chinese.btnLabel["Kiosk Mode"], "自助终端模式"],
      [chinese["report-heading"].Logs, "日志"],
    ];

    for (const [actual, expected] of expectedTerms) {
      assert.equal(actual, expected);
    }

    for (const [key, value] of flatten(chinese)) {
      assert.doesNotMatch(
        String(value),
        /(.{1,6})\1{3,}/u,
        `repeated translation fragment: ${key}`
      );
    }
  });
});
