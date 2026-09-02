import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "vitest";

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

const removeAllowedTechnicalReferences = (value) =>
  String(value)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\w.+-]+@opensignlabs\.com/gi, "")
    .replace(/@opensign\/react/gi, "")
    .replace(/opensign_hide_chat/gi, "");

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

  test("does not expose legacy branding in translation values", () => {
    for (const translationPath of [englishPath, chinesePath]) {
      const translations = flatten(
        JSON.parse(fs.readFileSync(translationPath, "utf8"))
      );

      for (const [key, value] of translations) {
        assert.doesNotMatch(
          removeAllowedTechnicalReferences(value),
          /open\s*sign(?:™)?/iu,
          `legacy branding in translation value: ${key}`
        );
      }
    }
  });

  test("does not expose legacy branding in default user-facing content", () => {
    const userFacingSources = [
      "src/components/emailbuilder/getConfiguration/sample/request-email.ts",
      "src/components/emailbuilder/getConfiguration/sample/completion-email.ts",
      "src/constant/Utils.js",
    ];

    for (const sourcePath of userFacingSources) {
      const source = fs.readFileSync(path.join(projectRoot, sourcePath), "utf8");
      assert.doesNotMatch(
        source,
        /["'`]OpenSign™["'`]|not compatible with opensign/iu,
        `legacy branding in user-facing source: ${sourcePath}`
      );
    }
  });

  test("uses the approved Xiangtai logo for default brand assets", () => {
    const approvedLogoHash =
      "b3fbb0b3962ea058885708cd55da03f7baa5d5bd89e2999cb8504f31d6c94cb2";
    const logoPaths = [
      "src/assets/images/logo.png",
      "public/static/js/assets/images/logo-dark.png",
      "public/xiangtai-logo.png",
    ];

    for (const logoPath of logoPaths) {
      const absolutePath = path.join(projectRoot, logoPath);
      assert.ok(fs.existsSync(absolutePath), `missing brand logo: ${logoPath}`);
      const hash = createHash("sha256")
        .update(fs.readFileSync(absolutePath))
        .digest("hex");
      assert.equal(hash, approvedLogoHash, `unexpected brand logo: ${logoPath}`);
    }

    const appInfoSource = fs.readFileSync(
      path.join(projectRoot, "src/constant/appinfo.js"),
      "utf8"
    );
    assert.match(appInfoSource, /fev_Icon:\s*logo/u);

    const titleSource = fs.readFileSync(
      path.join(projectRoot, "src/components/Title.jsx"),
      "utf8"
    );
    assert.match(
      titleSource,
      /localStorage\.getItem\("favicon"\)\s*\|\|\s*appInfo\.fev_Icon/u
    );
  });

  test("does not load the legacy hosted logo in frontend email content", () => {
    const emailSources = [
      "src/components/emailbuilder/getConfiguration/sample/request-email.ts",
      "src/components/emailbuilder/getConfiguration/sample/completion-email.ts",
      "src/constant/Utils.js",
    ];

    for (const sourcePath of emailSources) {
      const source = fs.readFileSync(path.join(projectRoot, sourcePath), "utf8");
      assert.doesNotMatch(
        source,
        /qikinnovation\.ams3\.digitaloceanspaces\.com\/logo\.png/iu,
        `legacy hosted logo in frontend email content: ${sourcePath}`
      );
      assert.match(
        source,
        /xiangtai-logo\.png/u,
        `missing Xiangtai logo in frontend email content: ${sourcePath}`
      );
    }
  });
});
