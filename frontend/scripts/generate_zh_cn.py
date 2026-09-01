#!/usr/bin/env python3
"""Generate the Simplified Chinese locale from the canonical English locale."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


MODEL_NAME = "facebook/nllb-200-distilled-600M"
PROTECTED = re.compile(
    r"({{\s*[^}]+\s*}}|https?://[^\s]+|<[^>]+>|OpenSign™?|Google Drive|HMAC-SHA256|PDF|API|OTP|SSO|URL|ID)"
)
TRANSLATABLE = re.compile(r"[A-Za-z]")

GLOSSARY = {
    "Create account": "创建账户",
    "Login": "登录",
    "Language": "语言",
    "Dark mode": "深色模式",
    "Name": "姓名",
    "Phone": "电话",
    "Optional": "选填",
    "Email": "邮箱",
    "Company": "公司",
    "Job title": "职位",
    "Profile": "个人资料",
    "Log Out": "退出登录",
    "Password": "密码",
    "Register": "注册",
    "Dashboard": "仪表盘",
    "Sign yourself": "自助签署",
    "Request signatures": "请求签名",
    "Templates": "模板",
    "Analytics": "数据分析",
    "Branding": "品牌设置",
    "Mail": "邮件",
    "Storage": "存储",
    "Signing certificate": "签署证书",
    "Teams": "团队",
    "General": "常规",
    "Documents": "文档",
    "Draft": "草稿",
    "Completed": "已完成",
    "Declined": "已拒绝",
    "Expired": "已过期",
    "Save": "保存",
    "Cancel": "取消",
    "Delete": "删除",
    "Download": "下载",
    "Rename": "重命名",
    "Move": "移动",
    "Add": "添加",
    "Edit": "编辑",
    "File": "文件",
    "pdf, png, jpg, jpeg": "PDF、PNG、JPG、JPEG",
    "Loading...": "加载中……",
    "Ascending": "升序",
    "Descending": "降序",
    "Date": "日期",
    "Pdf": "PDF",
    "Action": "操作",
    "of": "共",
    "Terms of Service": "服务条款",
    "Signup page": "注册页面",
    "sign": "签署",
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


def split_protected(value):
    return [part for part in PROTECTED.split(value) if part != ""]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()

    source = json.loads(args.input.read_text(encoding="utf-8"))
    translated = json.loads(json.dumps(source))
    cache = (
        json.loads(args.cache.read_text(encoding="utf-8"))
        if args.cache.exists()
        else {}
    )

    segments = []
    leaf_parts = []
    for path, value in iter_leaves(source):
        if value in GLOSSARY:
            leaf_parts.append((path, [GLOSSARY[value]]))
            continue
        parts = split_protected(value)
        leaf_parts.append((path, parts))
        for part in parts:
            if TRANSLATABLE.search(part) and not PROTECTED.fullmatch(part) and part not in cache:
                segments.append(part)

    unique_segments = list(dict.fromkeys(segments))
    if unique_segments:
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME, src_lang="eng_Latn"
        )
        model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
        device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
        model.to(device)
        model.eval()
        batch_size = 24
        for start in range(0, len(unique_segments), batch_size):
            batch = unique_segments[start : start + batch_size]
            encoded = tokenizer(
                batch,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            )
            encoded = {key: value.to(device) for key, value in encoded.items()}
            with torch.inference_mode():
                output = model.generate(
                    **encoded,
                    max_new_tokens=512,
                    num_beams=2,
                    forced_bos_token_id=tokenizer.convert_tokens_to_ids(
                        "zho_Hans"
                    ),
                )
            results = tokenizer.batch_decode(
                output.cpu(), skip_special_tokens=True
            )
            cache.update(zip(batch, results))
            args.cache.write_text(
                json.dumps(cache, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"translated {min(start + batch_size, len(unique_segments))}/{len(unique_segments)}")

    for path, parts in leaf_parts:
        value = "".join(cache.get(part, part) for part in parts)
        set_path(translated, path, value)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(translated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
