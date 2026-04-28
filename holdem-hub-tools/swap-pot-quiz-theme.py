"""
pot-quiz 다크 테마 → 라이트 + MIMIC red 일괄 swap.

heads-up와 동일 전략. zinc 팔레트(원본 다크 베이스) → 의미적 토큰으로 치환.
 - bg-zinc-{950,900,800,700} → bg-background / bg-card / bg-muted / bg-secondary
 - text-zinc-{100,200,300} → text-foreground (light text was on dark — 이제 dark text)
 - text-zinc-{400,500,600} → text-muted-foreground (보조 텍스트)
 - text-zinc-{700,800,900} → text-foreground (이미 dark, 유지)
 - border-zinc-{700,800} → border-border
 - border-zinc-{500,600,400} → border-input (입력 필드 류 강조)
 - bg-blue-{500,600,900} → bg-primary (원본 파란 primary → MIMIC red)
 - hover:bg-blue-* → hover:bg-primary/90
 - bg-purple-{500,600}, bg-indigo-* → bg-accent (보조 액센트)
 - text-white (bg-blue/bg-purple/bg-zinc-950과 함께) → text-primary-foreground
 - bg-zinc-100 / bg-zinc-400 / bg-zinc-500 (라이트 톤) → 그대로 유지 (라이트 테마에서도 valid)
"""
import re, pathlib, sys

ROOT = pathlib.Path("C:/work/mimic/mimic-games/holdem-hub/apps/pot-quiz/src")

# 순서: 더 구체적인 패턴 먼저
REPLACEMENTS = [
    # blue (원본 primary) → primary (MIMIC red)
    (r"\bbg-blue-600\b", "bg-primary"),
    (r"\bbg-blue-500\b", "bg-primary"),
    (r"\bbg-blue-900\b", "bg-primary"),
    (r"\bhover:bg-blue-500\b", "hover:bg-primary/90"),
    (r"\bhover:bg-blue-600\b", "hover:bg-primary/90"),
    (r"\bhover:bg-blue-700\b", "hover:bg-primary/90"),
    (r"\btext-blue-(\d+)\b", "text-primary"),

    # purple/indigo → accent
    (r"\bbg-purple-500\b", "bg-accent"),
    (r"\bbg-purple-600\b", "bg-accent"),
    (r"\bbg-indigo-500\b", "bg-accent"),
    (r"\bbg-indigo-600\b", "bg-accent"),

    # zinc base 다크 → 라이트 semantic
    (r"\bbg-zinc-950\b", "bg-background"),
    (r"\bbg-zinc-900\b", "bg-card"),
    (r"\bbg-zinc-800\b", "bg-muted"),
    (r"\bbg-zinc-700\b", "bg-secondary"),

    # 밝은 텍스트(원래 다크 위) → foreground
    (r"\btext-zinc-100\b", "text-foreground"),
    (r"\btext-zinc-200\b", "text-foreground"),
    (r"\btext-zinc-300\b", "text-foreground"),
    # 보조
    (r"\btext-zinc-400\b", "text-muted-foreground"),
    (r"\btext-zinc-500\b", "text-muted-foreground"),
    (r"\btext-zinc-600\b", "text-muted-foreground"),
    # 이미 어두운 텍스트 — 라이트 테마에선 그대로 OK
    (r"\btext-zinc-700\b", "text-foreground"),
    (r"\btext-zinc-800\b", "text-foreground"),
    (r"\btext-zinc-900\b", "text-foreground"),

    # border
    (r"\bborder-zinc-700\b", "border-border"),
    (r"\bborder-zinc-800\b", "border-border"),
    (r"\bborder-zinc-500\b", "border-input"),
    (r"\bborder-zinc-600\b", "border-input"),
    (r"\bborder-zinc-400\b", "border-input"),
]

# text-white이 bg-primary/bg-blue/bg-purple/bg-accent 같은 진한 색 위에 있으면 → text-primary-foreground
# 라이트 카드(bg-card, bg-background) 위면 → text-foreground
# 같은 className 토큰 안에서 함께 등장하는지 패턴 매칭
def swap_text_white_safe(content: str) -> str:
    out_lines = []
    for line in content.splitlines(keepends=True):
        if "text-white" not in line:
            out_lines.append(line)
            continue
        # 같은 줄에 진한 bg 클래스가 있으면 primary-foreground
        if re.search(r"\bbg-(primary|accent|destructive|red-\d+)\b", line):
            line = re.sub(r"\btext-white\b", "text-primary-foreground", line)
        # 라이트 bg 위면 foreground
        elif re.search(r"\bbg-(background|card|muted|secondary)\b", line) or "bg-white" in line:
            line = re.sub(r"\btext-white\b", "text-foreground", line)
        # 그 외 (예: bg 명시 없거나 bg-black/X 같은 오버레이 위) → 그대로 둠
        out_lines.append(line)
    return "".join(out_lines)


def process(path: pathlib.Path) -> bool:
    try:
        original = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return False
    new = original
    for pat, repl in REPLACEMENTS:
        new = re.sub(pat, repl, new)
    new = swap_text_white_safe(new)
    if new != original:
        path.write_text(new, encoding="utf-8")
        return True
    return False


def main():
    if not ROOT.exists():
        print(f"ERROR: not found {ROOT}", file=sys.stderr)
        sys.exit(1)
    changed = 0
    for ext in ("*.tsx", "*.ts"):
        for f in ROOT.rglob(ext):
            if process(f):
                changed += 1
                print(f"  ~ {f.relative_to(ROOT)}")
    print(f"\nUpdated {changed} files")


if __name__ == "__main__":
    main()
