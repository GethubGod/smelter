# App redesign, Sep 2026 (Smelter 2.4)

Approved Sep 12 2026: Studio design, Glide motion, Compact density.

| File | Purpose |
|---|---|
| `reference-glide.html` | The approved interactive reference. Build target and comparison baseline. Artifact: https://claude.ai/code/artifact/cd3f3dbc-6e50-40c9-8ba5-d794a14d2342 |
| `SPEC.md` | Written contract: tokens, geometry, per-screen structure and copy, motion, sheets, module gating, acceptance checklist |
| `HANDOFF.md` | Prompt 1 for Codex to build, Prompt 2 for a Claude agent to verify and fix |
| `index.html` | Earlier three-way motion comparison (Glide / Liquid / Band). Context only. Artifact: https://claude.ai/code/artifact/8d7114b0-a7c3-4e7f-8543-89632a2ed191 |
| `*.src.html` | Sources with the lockup PNG as a placeholder; the built files embed it |

Rebuild a built file from its source:

    python3 -c "import base64;s=open('reference-glide.src.html').read();b='data:image/png;base64,'+base64.b64encode(open('../../../brand/dist/lockup/smelter-lockup-600.png','rb').read()).decode();open('reference-glide.html','w').write(s.replace('__LOCKUP__',b))"
