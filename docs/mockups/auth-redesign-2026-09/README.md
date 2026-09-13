# Auth redesign, Sep 2026

Chosen Sep 13 2026: version C (welcome with three doors, sign-in sheet, three-step invite, account creation on smelterpos.com in the in-app browser).

| File | Purpose |
|---|---|
| `reference-c.html` | The interactive reference for version C. Every control on the phone works, including the website inside the in-app browser. Build target. |
| `SPEC.md` | Written contract: tokens, anatomy, per-screen structure and copy, motion, backend changes, acceptance checklist |
| `HANDOFF.md` | Prompt 1 for Codex to build, Prompt 2 for a Claude agent to verify and fix, the one open question |
| `WEB-HANDOFF.md` | Prompt for the smelterpos.com/signup page (request access, David provisions) and the dashboard approval card |
| `reference-c.src.html` | Source with `__LOCKUP__` / `__MARK__` placeholders; the built file embeds the PNGs |
| `index.html` | The earlier three-way comparison (A front door, B one field, C pick your path). Context only. |

Rebuild the built file from its source:

    python3 -c "import base64;s=open('reference-c.src.html').read();L='data:image/png;base64,'+base64.b64encode(open('../../../brand/dist/lockup/smelter-lockup-600.png','rb').read()).decode();M='data:image/png;base64,'+base64.b64encode(open('../../../brand/dist/mark/smelter-mark-128.png','rb').read()).decode();open('reference-c.html','w').write(s.replace('__LOCKUP__',L).replace('__MARK__',M))"

Serve locally: `.claude/launch.json` has an `auth-mockup` entry on port 8766.
