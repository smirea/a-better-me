"""Dump printable strings from MF Workouts' Dart AOT snapshot.

Dart stores Latin-1 strings one byte per char and any string with a char above
U+00FF (curly quotes, em dashes, CJK) as UTF-16LE, so `strings` alone misses
most UI copy that uses typographic apostrophes.

Usage: python3 -I app-strings.py [App binary] > strings.txt
"""
import re
import sys

DEFAULT = "/Applications/Runner.app/Wrapper/Runner.app/Frameworks/App.framework/App"

data = open(sys.argv[1] if len(sys.argv) > 1 else DEFAULT, "rb").read()
seen = set()


def emit(s):
    s = s.strip()
    if len(s) >= 4 and s not in seen:
        seen.add(s)
        print(s)


WORD = re.compile(r"[A-Za-z]{3}")

for m in re.finditer(rb"[\x20-\x7e\xa0-\xff]{4,}", data):
    s = m.group().decode("latin-1")
    if WORD.search(s):
        emit(s)
for m in re.finditer(rb"(?:[\x20-\x7e\xa0-\xff]\x00|[\x00-\xff]\x20)+", data):
    s = m.group().decode("utf-16-le")
    if any(ord(c) > 0xFF for c in s) and WORD.search(s):
        emit(s)
