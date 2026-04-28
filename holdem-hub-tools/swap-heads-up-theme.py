"""
heads-up 다크 테마 → 라이트 + MIMIC red 일괄 swap.

전략: utility class 텍스트를 의미적(semantic) 토큰으로 치환.
 - bg-gold → bg-primary (gold = MIMIC red 자리)
 - hover:bg-yellow-* → hover:bg-primary/90 (gold hover variant)
 - bg-neutral-{900,950} → bg-background / bg-card (다크 베이스 → 라이트)
 - text-neutral-{100,200,300} → text-foreground (밝은 텍스트 → 검은 텍스트)
 - text-neutral-{400,500,600} → text-muted-foreground (보조 텍스트)
 - border-neutral-{700,800,600} → border-border
 - text-neutral-900 (gold 버튼 글자) → text-primary-foreground (빨강 위 흰 글자)

felt-green / card-back / bg-white(카드 면)은 그대로 유지 — 게임플레이 색상.
"""
import re, pathlib, sys

ROOT = pathlib.Path("C:/work/mimic/mimic-games/holdem-hub/apps/heads-up/src")

# 순서 중요. 더 긴 패턴(더 구체적)이 먼저 와야 짧은 게 잘못 매칭하지 않음.
REPLACEMENTS = [
    # gold → primary 계열 (가장 먼저 — text-neutral-900 처리 전에 컨텍스트 식별)
    (r"\bbg-gold\b", "bg-primary"),
    (r"\bhover:bg-gold\b", "hover:bg-primary/90"),
    (r"\btext-gold\b", "text-primary"),
    (r"\bhover:text-gold\b", "hover:text-primary"),
    (r"\bborder-gold\b", "border-primary"),
    (r"\bring-gold\b", "ring-primary"),
    (r"\bfocus:ring-gold\b", "focus:ring-primary"),
    # gold 버튼의 hover yellow → primary/90 (살짝 어두운 빨강)
    (r"\bhover:bg-yellow-500\b", "hover:bg-primary/90"),
    (r"\bhover:bg-yellow-600\b", "hover:bg-primary/90"),

    # neutral 다크 base → 라이트 semantic
    (r"\bbg-neutral-950\b", "bg-background"),
    (r"\bbg-neutral-900\b", "bg-card"),
    (r"\bbg-neutral-800\b", "bg-muted"),
    (r"\bbg-neutral-700\b", "bg-secondary"),
    (r"\bbg-neutral-600\b", "bg-muted"),

    # 밝은 텍스트(원래 다크 위) → foreground (라이트에선 검은 텍스트)
    (r"\btext-neutral-100\b", "text-foreground"),
    (r"\btext-neutral-200\b", "text-foreground"),
    (r"\btext-neutral-300\b", "text-foreground"),
    # 보조 텍스트
    (r"\btext-neutral-400\b", "text-muted-foreground"),
    (r"\btext-neutral-500\b", "text-muted-foreground"),
    (r"\btext-neutral-600\b", "text-muted-foreground"),
    (r"\btext-neutral-700\b", "text-foreground"),

    # border
    (r"\bborder-neutral-700\b", "border-border"),
    (r"\bborder-neutral-800\b", "border-border"),
    (r"\bborder-neutral-600\b", "border-border"),

    # gold 버튼의 텍스트 — 빨강 위 흰 글자
    # 단, 카드 면(Card.tsx의 'bg-white border-neutral-300 text-neutral-900')은 유지해야 함.
    # 이 패턴은 bg-white와 함께 등장 — bg-white는 별도 처리하지 않으니 text-neutral-900도 유지.
    # 따라서 'bg-white' 와 같은 줄에 있지 않은 text-neutral-900만 교체.
]

# bg-white 짝의 text-neutral-900은 그대로 둬야 (Card 카드 면)
# 별도 함수로 라인별 처리.
def swap_text_neutral_900_safe(content: str) -> str:
    out_lines = []
    for line in content.splitlines(keepends=True):
        if "text-neutral-900" in line and "bg-white" not in line:
            line = re.sub(r"\btext-neutral-900\b", "text-primary-foreground", line)
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
    new = swap_text_neutral_900_safe(new)
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
