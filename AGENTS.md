# AGENTS.md

The short version of `CLAUDE.md`, for any coding agent working in this repo.

**What this is:** a book engine. One concept per page, strict B5 (176 x 250 mm), the same
CSS driving screen and print.

**The loop, after every change:**

```bash
node engine/tools/build-book.mjs books/<slug>
node engine/tools/check.mjs      books/<slug>/book.html   # must read 0 mm everywhere
node engine/tools/shot.mjs       books/<slug>/book.html   # then LOOK at the PNGs
```

**Rules you must not break:**

1. `book.html` is generated. Edit `books/<slug>/<slug>.html` and `book.json` instead.
2. Books live exactly two folders deep (`books/<slug>/`); pages link `../../engine/…`.
3. Never add an `@media print` rule that changes a size, a font, or an image.
4. A page must never overflow. If it does, cut words. Never shrink a diagram's `viewBox`
   to make it fit, because that clips the drawing instead of fixing it.
5. Diagrams are inline SVG, never generated images. Photos are for physical subjects.
6. Colour is a role: indigo is the mechanism, teal the good outcome, red the threat or
   mistake, amber the thing protected, neutral the reader.
7. Never invent a fact, a number, or a story for a page.
8. Give every SVG `<text>` an explicit `fill`, or it can inherit its way to invisible.
9. No scratch files. Do not leave throwaway scripts in the repo — no `_x.mjs`,
   `tmp.mjs`, `debug.mjs`, `scratch/`, or one-off scripts parked in `engine/tools/`.
   Investigation code lives in the system temp directory, not in the repo. Throwaway
   code used only to test something belongs under `test/`, created and removed inside
   the test that needs it. If a tool becomes a real tool, it earns a permanent name and
   a test; otherwise delete it when you are done.

**A new page** is one `<section class="sheet bb">` in the interior file, plus its title
added to a part in `book.json`. Copy
`.claude/skills/block/references/example-page.html`.

**Full authoring guidance** (voice, diagram vocabulary, design rules, photo prompts) is
in `.claude/skills/block/`. Read `SKILL.md` there before writing a page.
