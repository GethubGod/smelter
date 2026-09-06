#!/usr/bin/env python3
"""Summarise an AXe describe-ui dump into tappable label/centre pairs.

Usage: scripts/release-readiness/ui-summary.py <file-ui.json> [substring]

Prints one line per element that carries a label, title or value, with the
centre point to tap. Used by the issue #40 mutation pass so taps are driven
from the accessibility tree rather than guessed coordinates.
"""
import json
import sys


def walk(node, out):
    if isinstance(node, list):
        for child in node:
            walk(child, out)
        return
    if not isinstance(node, dict):
        return
    label = node.get('AXLabel') or node.get('label') or ''
    title = node.get('AXTitle') or node.get('title') or ''
    value = node.get('AXValue') or node.get('value') or ''
    role = node.get('role') or node.get('type') or node.get('AXType') or ''
    frame = node.get('frame') or node.get('AXFrame') or {}
    text = ' | '.join(str(x) for x in (label, title, value) if x)
    if text and isinstance(frame, dict) and 'x' in frame:
        cx = frame['x'] + frame.get('width', 0) / 2
        cy = frame['y'] + frame.get('height', 0) / 2
        out.append((round(cx), round(cy), role, text[:110],
                    round(frame.get('width', 0)), round(frame.get('height', 0))))
    for key in ('children', 'AXChildren'):
        if key in node:
            walk(node[key], out)


def main():
    path = sys.argv[1]
    needle = sys.argv[2].lower() if len(sys.argv) > 2 else None
    out = []
    walk(json.load(open(path)), out)
    seen = set()
    for cx, cy, role, text, w, h in out:
        key = (cx, cy, text)
        if key in seen:
            continue
        seen.add(key)
        if needle and needle not in text.lower():
            continue
        print(f'({cx},{cy}) {w}x{h} {role}: {text}')


if __name__ == '__main__':
    main()
