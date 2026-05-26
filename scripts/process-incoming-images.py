#!/usr/bin/env python3
"""Compress and place the /incoming batch of generated images.

Mapping table is inline. Run from repo root:
    python3 scripts/process-incoming-images.py

Targets per image type (per /image-prompts-v2.md):
- Avatars (`ach-*` / `mb-*`):  192x192 PNG quality 85, <25 KB
- Tier icons (`big-dawg.png`): 192x192 PNG, transparent, <35 KB
- Day-card heroes (`day-*.jpg`): 1024x768 JPG quality 80, <=80 KB
"""

import os
import sys
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INC = os.path.join(REPO, "incoming")

MAPPING = [
    # (uuid filename in incoming/, target path relative to repo root, kind)
    ("0623B40F-1470-418F-9727-4AC165CF0D7D.png", "public/avatars/ach-spark.png", "avatar"),
    ("CF2C8A73-AF06-48B3-A0FD-941453279E3C.png", "public/avatars/ach-hammer.png", "avatar"),
    ("B304DF06-3E9A-4F50-B9BB-617886F75E0E.png", "public/avatars/ach-anvil.png", "avatar"),
    ("AAC8B3D9-F11D-4A84-A3C6-ACDE8226CF04.png", "public/avatars/ach-phoenix.png", "avatar"),
    ("8530D3E1-E626-4E3D-AD1A-79D128A05B4B.png", "public/avatars/ach-crucible.png", "avatar"),
    ("60506181-47A4-4EDD-B61A-796A9145F3AF.png", "public/avatars/ach-blacksmith.png", "avatar"),
    ("FD4CA8BE-DEBF-46E8-A5A8-8BDA2A0AA21B.png", "public/avatars/ach-forge-eternal.png", "avatar"),
    ("AEC77C24-2549-4D5D-82C4-AB8963C772B2.png", "public/avatars/mb-pushup-elite.png", "avatar"),
    ("3DB769D3-16FD-4361-8309-6C862E87CB96.png", "public/avatars/mb-pullup-elite.png", "avatar"),
    ("19472DDD-3396-47ED-BBB2-64B888FF4D2E.png", "public/avatars/mb-situp-elite.png", "avatar"),
    ("0C380A54-0AA2-4F49-B1DE-04D484DD9E2A.png", "public/avatars/mb-dip-elite.png", "avatar"),
    ("97742B32-07DA-45FE-B1C2-26588179A5DA.png", "public/avatars/mb-bwsquat-elite.png", "avatar"),
    ("F6747A30-181F-4E93-9BD0-52F8AAC5B411.png", "public/ai/day-cardio.jpg", "day-hero"),
    ("1074A2B3-D2A6-4987-BD5F-74DB41D23143.png", "public/ai/day-hiit.jpg", "day-hero"),
    ("89E0B311-9E83-4319-B220-EEA836E256F1.png", "public/ai/day-bw-only.jpg", "day-hero"),
    ("6A64A2FB-BD62-45C0-B9E7-5C56B865F30B.png", "public/ai/day-mobility.jpg", "day-hero"),
    ("6B8189F3-5DC6-462C-B43E-F9FB9880733B.png", "public/ai/day-recovery.jpg", "day-hero"),
    ("186F49FA-CB65-4022-B313-932450CFEB8C.png", "public/ai/day-cardio-hiit.jpg", "day-hero"),
    ("B414D53F-7242-45C4-BB2C-6A5965049815.png", "public/ai/day-bw-strength.jpg", "day-hero"),
    ("7ED26311-4BD2-4B85-87E0-A6DCB11E0A49.png", "public/tier-icons/vivid/big-dawg.png", "tier-icon"),
]


def process_avatar(src, dst):
    im = Image.open(src).convert("RGBA")
    im.thumbnail((192, 192), Image.LANCZOS)
    if im.size != (192, 192):
        canvas = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        canvas.paste(im, ((192 - im.size[0]) // 2, (192 - im.size[1]) // 2), im)
        im = canvas
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "PNG", optimize=True)


def process_tier_icon(src, dst):
    """Tier icons are transparent crests. Source may include subtle aura
    background — keep RGBA, resize to 192x192."""
    im = Image.open(src).convert("RGBA")
    im.thumbnail((192, 192), Image.LANCZOS)
    if im.size != (192, 192):
        canvas = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        canvas.paste(im, ((192 - im.size[0]) // 2, (192 - im.size[1]) // 2), im)
        im = canvas
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "PNG", optimize=True)


def process_day_hero(src, dst):
    """Day-card hero JPG — full-bleed photographic background.
    Source is square (~1024x1024). Crop to 4:3 (1024x768) centered, JPG q80."""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    target_ratio = 1024 / 768
    if w / h > target_ratio:
        new_w = int(h * target_ratio)
        off = (w - new_w) // 2
        im = im.crop((off, 0, off + new_w, h))
    else:
        new_h = int(w / target_ratio)
        off = (h - new_h) // 2
        im = im.crop((0, off, w, off + new_h))
    im = im.resize((1024, 768), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "JPEG", quality=80, optimize=True, progressive=True)


HANDLERS = {
    "avatar": process_avatar,
    "tier-icon": process_tier_icon,
    "day-hero": process_day_hero,
}

TARGETS_KB = {"avatar": 25, "tier-icon": 35, "day-hero": 80}


def main():
    moved = []
    over_budget = []
    for src_name, dst_rel, kind in MAPPING:
        src = os.path.join(INC, src_name)
        dst = os.path.join(REPO, dst_rel)
        if not os.path.exists(src):
            print(f"SKIP (missing): {src_name}")
            continue
        HANDLERS[kind](src, dst)
        size_kb = os.path.getsize(dst) / 1024
        target_kb = TARGETS_KB[kind]
        flag = "OK" if size_kb <= target_kb else "OVER"
        if flag == "OVER":
            over_budget.append((dst_rel, size_kb, target_kb))
        print(f"{flag:4s}  {dst_rel:55s}  {size_kb:6.1f} KB / {target_kb} KB")
        moved.append(src)

    print()
    print(f"Processed: {len(moved)}/{len(MAPPING)}")
    if over_budget:
        print(f"\nOver budget ({len(over_budget)}):")
        for path, kb, tgt in over_budget:
            print(f"  - {path}: {kb:.1f} KB > {tgt} KB target")

    # Remove originals from /incoming
    for src in moved:
        os.remove(src)
    # Stray `d` placeholder
    for stray in ("d",):
        p = os.path.join(INC, stray)
        if os.path.exists(p):
            os.remove(p)
            print(f"removed stray /incoming/{stray}")
    # Remove the incoming folder if empty
    try:
        remaining = os.listdir(INC)
        if not remaining:
            os.rmdir(INC)
            print("removed empty /incoming/")
        else:
            print(f"/incoming/ still has: {remaining}")
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    main()
