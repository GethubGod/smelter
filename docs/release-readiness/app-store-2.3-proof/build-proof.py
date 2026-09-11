#!/usr/bin/env python3
"""Build docs/release-readiness/app-store-2.3-proof/index.html from proof.json.

One self-contained page, relative image links, no scripts, no external assets.
Nothing is PASS unless the card carries a screenshot or an assertion.
"""
from pathlib import Path
import html
import json

HERE = Path(__file__).resolve().parent
REPORT = HERE.parent


def esc(value):
    return html.escape(str(value), quote=True)


def rel(path):
    """Relative link from this folder to an evidence path given relative to docs/release-readiness."""
    target = (REPORT / path).resolve()
    if not target.is_file():
        raise FileNotFoundError(path)
    return esc(Path(*(['..'] * 1), path).as_posix())


def figure(path, caption):
    return f'<figure><img src="{rel(path)}" alt="{esc(caption)}" loading="lazy"><figcaption>{esc(caption)}<br><code>{esc(path)}</code></figcaption></figure>'


def verdict(v):
    cls = 'pass' if v == 'PASS' else 'fail' if v == 'FAIL' else 'review'
    return f'<span class="verdict {cls}">{esc(v)}</span>'


def card(issue):
    has_evidence = bool(issue.get('after')) or bool(issue.get('proof'))
    v = issue['verdict']
    if v == 'PASS' and not has_evidence:
        v = 'NOT PROVEN'
    steps = ''.join(f'<li>{esc(s)}</li>' for s in issue['steps'])
    before = ''.join(figure(p, c) for p, c in issue.get('before', []))
    after = ''.join(figure(p, c) for p, c in issue.get('after', []))
    proof = ''.join(f'<h4>{esc(p["title"])}</h4><pre>{esc(p["text"])}</pre>' for p in issue.get('proof', []))
    notes = ''.join(f'<p>{esc(n)}</p>' for n in issue.get('notes', []))
    return f'''<section class="card {v.lower().replace(" ", "-")}" id="issue-{issue["number"]}">
<h2>#{issue["number"]} {esc(issue["title"])} {verdict(v)}</h2>
<p class="muted">{esc(issue.get("fixed_in", ""))}</p>
<h3>Steps driven</h3><ol>{steps}</ol>
<div class="cols"><div><h3>Before (original evidence)</h3><div class="shots">{before or "<p class=muted>No before image: the behaviour did not exist before this milestone.</p>"}</div></div>
<div><h3>After (this Release build)</h3><div class="shots">{after or "<p class=muted>No screenshot.</p>"}</div></div></div>
{proof}{notes}</section>'''


def main():
    data = json.loads((HERE / 'proof.json').read_text())
    b = data['build']
    build_rows = ''.join(f'<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>' for k, v in b['facts'])
    prs = ''.join(f'<li>{esc(p)}</li>' for p in b['prs'])
    cards = ''.join(card(i) for i in data['issues'])
    summary_rows = ''.join(
        f'<tr><td><a href="#issue-{i["number"]}">#{i["number"]}</a></td><td>{esc(i["title"])}</td><td>{verdict(i["verdict"])}</td><td>{esc(i.get("summary", ""))}</td></tr>'
        for i in data['issues'])
    d = data['drift']
    drift = f'<table><tr><th>Before the sweeps</th><td>{esc(d["before"])}</td></tr><tr><th>Now</th><td>{esc(d["after"])}</td></tr><tr><th>Mechanism</th><td>{esc(d["mechanism"])}</td></tr></table><h4>Probe</h4><pre>{esc(d["probe"])}</pre>'
    routes = json.loads((REPORT / 'route-inventory.json').read_text())
    counts = {}
    for r in routes:
        counts[r['status']] = counts.get(r['status'], 0) + 1
    route_counts = ', '.join(f'{k} {v}' for k, v in sorted(counts.items()))
    route_rows = ''.join(
        f'<tr><td><code>{esc(r["file"])}</code></td><td>{verdict("PASS" if r["status"] == "Pass" else "FAIL" if r["status"] in ("Fail", "Blocked") else r["status"].upper())}</td><td>{esc(r.get("notes", ""))}</td></tr>'
        for r in routes)
    sheet = ''.join(figure(s['path'], s['caption']) for s in data['route_sheet'])
    commands = ''.join(f'<tr><td><code>{esc(c["command"])}</code></td><td>{verdict(c["result"])}</td><td>{esc(c["detail"])}</td></tr>' for c in data['commands'])
    needs = esc(data['needs_david'])
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>App Store 2.3 proof</title><style>
:root{{--ink:#142b3a;--muted:#536472;--paper:#f5f4ef;--line:#d8dedf;--red:#b53126;--green:#166549;--amber:#755713}}*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}header{{background:var(--ink);color:#fff;padding:40px max(24px,calc((100vw - 1160px)/2)) 30px}}header h1{{margin:0 0 8px;font-size:34px;letter-spacing:-.03em}}header p{{margin:4px 0;color:#dce5e9}}main{{max-width:1208px;margin:auto;padding:24px}}nav{{display:flex;gap:14px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--line)}}a{{color:inherit}}h2{{font-size:22px;margin:28px 0 10px}}h3{{font-size:15px;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}}h4{{margin:12px 0 4px}}table{{border-collapse:collapse;width:100%;background:#fff;font-size:13px}}th,td{{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}}th{{background:#e7ecec;white-space:nowrap}}code{{font:12px ui-monospace,Menlo,monospace;overflow-wrap:anywhere}}pre{{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px;font:12px/1.45 ui-monospace,Menlo,monospace;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}}.verdict{{display:inline-block;font-size:12px;font-weight:700;border-radius:4px;padding:2px 8px;vertical-align:middle}}.pass{{background:#e2f3e8;color:var(--green)}}.fail{{background:var(--red);color:#fff}}.review{{background:#f5edcc;color:var(--amber)}}.card{{background:#fff;border:1px solid var(--line);border-left:6px solid var(--green);border-radius:10px;padding:16px 20px;margin:18px 0}}.card.fail{{border-left-color:var(--red)}}.card.not-proven{{border-left-color:var(--amber)}}.cols{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}@media(max-width:900px){{.cols{{grid-template-columns:1fr}}}}.shots{{display:flex;flex-wrap:wrap;gap:12px}}figure{{margin:0;width:200px}}figure img{{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:8px;background:#eef0ef}}figcaption{{font-size:12px;color:var(--muted);padding-top:4px}}.sheet{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}}.sheet figure{{width:auto}}.muted{{color:var(--muted)}}.scroll{{overflow:auto;border:1px solid var(--line);border-radius:8px}}footer{{margin-top:40px;font-size:12px;color:var(--muted)}}
</style></head><body><header><h1>App Store 2.3 proof</h1><p>{esc(b["summary"])}</p><p>Integration head <code>{esc(b["integration_sha"])}</code>, proof branch <code>{esc(b["branch"])}</code>, generated {esc(b["date"])}.</p></header><main>
<nav><a href="#build">Build identity</a><a href="#summary">Verdicts</a><a href="#issues">Issue cards</a><a href="#drift">Drift</a><a href="#routes">Route pass</a><a href="#commands">Commands</a><a href="#needs-david">NEEDS-DAVID</a></nav>
<h2 id="build">Build identity</h2><div class="scroll"><table>{build_rows}</table></div><h3>PRs on this head</h3><ul>{prs}</ul>
<h2 id="summary">Verdicts</h2><div class="scroll"><table><tr><th>Issue</th><th>Title</th><th>Verdict</th><th>One line</th></tr>{summary_rows}</table></div>
<h2 id="issues">Issue cards</h2>{cards}
<h2 id="drift">Design drift</h2>{drift}
<h2 id="routes">Route pass</h2><p>{esc(data["route_note"])}</p><p>Inventory statuses: {esc(route_counts)}.</p><div class="scroll"><table><tr><th>Route file</th><th>Status</th><th>Notes from this pass</th></tr>{route_rows}</table></div>
<h3>Contact sheet</h3><div class="sheet">{sheet}</div>
<h2 id="commands">Commands and results</h2><div class="scroll"><table><tr><th>Command</th><th>Result</th><th>Detail</th></tr>{commands}</table></div>
<h2 id="needs-david">NEEDS-DAVID</h2><p class="muted">Copied from docs/launch-plan/NEEDS-DAVID.md at generation time.</p><pre>{needs}</pre>
<footer>Every screenshot on this page was captured from the simulator framebuffer of {esc(b["sim"])} through scripts/sim.sh. Database assertions ran with psql against the disposable local stack. Nothing here touches production.</footer></main></body></html>'''
    (HERE / 'index.html').write_text(page)
    print(f'Wrote {HERE / "index.html"}: {len(data["issues"])} issue cards, {len(data["route_sheet"])} contact sheet images, {len(routes)} route rows')


if __name__ == '__main__':
    main()
