#!/usr/bin/env python3
"""Polish the generated locale with a context-aware local Chinese model."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.request
from pathlib import Path


OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "qwen2.5:1.5b"
PLACEHOLDER = re.compile(r"{{\s*[^}]+\s*}}")
TRANSLATABLE = re.compile(r"[A-Za-z]")

SYSTEM_PROMPT = """You are a professional Mainland Chinese software localization editor for OpenSign, an electronic-signature and contract web application.
Translate every English UI value into concise, natural Simplified Chinese. Use the supplied path as context. Return one JSON object mapping each numeric id to its translated string, with no explanation.

Terminology:
- document=文档, folder=文件夹, signer=签署人, sign (verb)=签署, signature (noun)=签名
- request signatures=请求签名, need your sign=待我签署, template=模板, draft=草稿
- decline=拒签, revoke=撤销, audit trail=审计记录, completion certificate=签署完成证书
- OpenSign Drive={{appName}} 云盘 when the source contains {{appName}}, otherwise OpenSign 云盘
- Kiosk Mode=自助终端模式, contact book=通讯录, premium credits=高级额度

Rules:
- Preserve placeholders exactly, including {{appName}} and every {{...}} token.
- Preserve URLs, email addresses, HTML tags, OpenSign, PDF, API, OTP, SSO, SMTP, Webhook and HMAC-SHA256.
- Do not translate product names as ordinary verbs. Do not add information. Avoid literal or awkward translations.
- Use short standard labels for buttons and navigation."""

PATH_OVERRIDES = {
    "folder": "文件夹",
    "docs": "文档",
    "pro": "专业版",
    "public-profile": "公开资料",
    "sidebar.OpenSign™ Drive": "{{appName}} 云盘",
    "sidebar.Documents-Children.Need your sign": "待我签署",
    "btnLabel.sign": "签署",
    "btnLabel.Sign": "签署",
    "btnLabel.View": "查看",
    "btnLabel.Kiosk Mode": "自助终端模式",
    "report-heading.Logs": "日志",
}


def iter_leaves(value, path=()):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from iter_leaves(child, (*path, key))
    else:
        yield path, str(value)


def set_path(root, path, value):
    node = root
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value


def placeholders(value):
    return sorted(PLACEHOLDER.findall(value))


def request_translation(items):
    request_body = {
        "model": MODEL,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(items, ensure_ascii=False),
            },
        ],
        "options": {"temperature": 0, "num_ctx": 8192},
    }
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        body = json.loads(response.read())
    return json.loads(body["message"]["content"])


def translate_batch(batch):
    payload = {
        str(index): {"path": path, "english": english}
        for index, (path, english) in enumerate(batch)
    }
    for attempt in range(3):
        try:
            result = request_translation(payload)
            translations = {}
            for index, (path, english) in enumerate(batch):
                value = str(result[str(index)]).strip()
                if not value or placeholders(value) != placeholders(english):
                    raise ValueError(f"invalid translation for {path}")
                translations[path] = value
            return translations
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("english", type=Path)
    parser.add_argument("draft", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()

    english = json.loads(args.english.read_text(encoding="utf-8"))
    polished = json.loads(args.draft.read_text(encoding="utf-8"))
    cache = (
        json.loads(args.cache.read_text(encoding="utf-8"))
        if args.cache.exists()
        else {}
    )

    pending = []
    paths = {}
    for path_parts, value in iter_leaves(english):
        path = ".".join(path_parts)
        paths[path] = path_parts
        if path in PATH_OVERRIDES:
            cache[path] = PATH_OVERRIDES[path]
        elif not TRANSLATABLE.search(value):
            cache[path] = value
        elif path not in cache:
            pending.append((path, value))

    batch_size = 64
    for start in range(0, len(pending), batch_size):
        batch = pending[start : start + batch_size]
        cache.update(translate_batch(batch))
        args.cache.write_text(
            json.dumps(cache, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"polished {min(start + batch_size, len(pending))}/{len(pending)}")

    for path, path_parts in paths.items():
        set_path(polished, path_parts, cache[path])

    args.output.write_text(
        json.dumps(polished, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
