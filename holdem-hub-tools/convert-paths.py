"""One-shot helper: convert @/foo imports → relative paths inside a directory tree."""
import os, re, sys, pathlib

if len(sys.argv) < 2:
    print("usage: convert-paths.py <src-dir>")
    sys.exit(1)

ROOT = pathlib.Path(sys.argv[1])

def relpath_from(file_dir: str, target: str) -> str:
    rel = os.path.relpath(target, file_dir)
    rel = rel.replace(os.sep, "/")
    return rel

def convert(file_path: pathlib.Path) -> bool:
    rel_dir = file_path.parent.relative_to(ROOT).as_posix() or "."

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    def replace(m):
        target = m.group(1)  # e.g. "components/ui/toast"
        new_path = relpath_from(rel_dir, target)
        if not new_path.startswith("."):
            new_path = "./" + new_path
        return f'from "{new_path}"'

    new_content = re.sub(r'from "@/([^"]+)"', replace, content)
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    return False

count = 0
for ext in ("*.tsx", "*.ts"):
    for f in ROOT.rglob(ext):
        if convert(f):
            count += 1
print(f"Converted {count} files")
