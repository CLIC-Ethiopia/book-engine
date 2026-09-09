# STEAM-IE Book Prompt

A ready-to-use prompt file for creating a STEAM-IE curriculum book.
Edit the placeholders below, then copy the entire file into your prompt.

---

## How to Use This File

1. Read through every `[PLACEHOLDER]` and replace it with your content.
2. Copy the entire file into your prompt.
3. I will return the full STEAM-IE page breakdown for your confirmation.
4. After you confirm, I draft all pages, show you, wait for your edits, then build.

---

## THE PROMPT — Copy Everything Below This Line

---

I want to create a STEAM-IE curriculum book.

**Topic:** [Describe your topic in one sentence. Example: "Hydroponics and vertical farming for small-scale commercial growers."]

**Audience:** [Who is reading? Example: "Vocational students in Ethiopia, ages 16–22, with no prior greenhouse experience."]

**End goal of this book:** [What should the reader be able to do by the end? Example: "Students build and operate their own small greenhouse that grows vegetables for sale."]

**Book details:**
- Title: [Your book title]
- Subtitle: [One sentence about what the book covers]
- Author: [Your name]

---

### STEAM-IE Colour System

Every page in this book uses the section's colour in three places: the left-edge tab, the eyebrow text, and the diagram accent.

| Letter | Section | Hex Code |
|--------|---------|----------|
| S | Science | #e61358 |
| T | Technology | #ed7d1f |
| E | Engineering | #a0c82f |
| A | Arts | #32b5d3 |
| M | Mathematics | #b44b97 |
| I | Innovation | #306a50 |
| E | Entrepreneurship | #5441ff |

Body text, page title, explainer, action box, and footer stay in the book's neutral palette. The section colour is signal, not decoration.

Every SVG diagram on a STEAM-IE page uses the section's hex code as the primary fill or stroke for the idea being taught. Other elements in the diagram (background, neutral labels, secondary lines) stay neutral.

---

### STEAM-IE Page Outline

For each STEAM-IE section, list the concepts you want covered, or say "please suggest N pages":

- **S — Science:** [List concepts or say "please suggest N pages about the science behind this topic"]
- **T — Technology:** [List concepts or say "please suggest N pages about the tools and technologies used"]
- **E — Engineering:** [List concepts or say "please suggest N pages about the construction and systems"]
- **A — Arts:** [List concepts or say "please suggest N pages about design and creativity"]
- **M — Mathematics:** [List concepts or say "please suggest N pages about calculations and measurements"]
- **I — Innovation:** [List concepts or say "please suggest N pages about local adaptations and improvements"]
- **E — Entrepreneurship:** [List concepts or say "please suggest N pages about the business side"]

---

### Constraints and Preferences

- **Local context:** [Any local specifics. Example: "All costs in Ethiopian birr. Local materials available: PVC pipes, used IBC tanks, corrugated iron sheets."]
- **Image preferences:** [Which pages need photos vs diagrams. Example: "I will supply my own photos for the Technology section. Generate diagrams for everything else."]
- **First section to write:** [Which STEAM-IE letter to start with. Example: "Write the Science section first."]
- **Free sample pages:** [Which pages should be available as free samples? Example: "Make the first Science page and the first Entrepreneurship page free samples."]
- **Additional notes:** [Anything else specific to this book]

---

### Your Response Requested

Please propose the full STEAM-IE page breakdown. For each section, list the block title, a one-line description, and the band type (diagram or photo) for each page.

I will confirm which pages to write first and in what order. Write all drafts, show me grouped by STEAM-IE letter, wait for my edits, then build when I say so.

---

## VOICE.md Additions — Add to Your Book's VOICE.md

After creating your book folder, add this block to `books/<slug>/VOICE.md`:

```markdown
## STEAM-IE Structure

This book follows the STEAM-IE curriculum format. Each section (Science,
Technology, Engineering, Arts, Mathematics, Innovation, Entrepreneurship)
is introduced by a part-divider page whose `why` sentence bridges from the
previous section.

The voice is the same across all sections. The transition between letters
is a change in focus, not a change in tone.

The Science section opens with "Let's say…" and a situation.
The Entrepreneurship section ends with a sentence the reader can repeat
to a potential customer.

Between sections, the `why` sentence on the part-divider page does the
bridging work.

## STEAM-IE Colour System

This book uses one colour per STEAM-IE section. The colour is signal,
not decoration.

| Letter | Hex |
|--------|-----|
| S | #e61358 |
| T | #ed7d1f |
| E | #a0c82f |
| A | #32b5d3 |
| M | #b44b97 |
| I | #306a50 |
| E | #5441ff |

The section colour appears in three places on every page in that section:
the left-edge tab, the eyebrow text, and the diagram accent for the idea
being taught.

Body text, page title, explainer, action box, and footer stay in the
book's neutral palette. Do not introduce additional colours. The section
colour is loud on purpose.
```

---

## book.json Template — STEAM-IE Structure

Use this as your starting point for `book.json`. Replace every `[PLACEHOLDER]`.

```json
{
  "title": "[Your Book Title]",
  "subtitle": "[Your subtitle in one sentence]",
  "author": "[Your Name]",

  "series": "[Your Series Name]",
  "brand": "[yourdomain.com]",
  "editionLabel": "Edition 1.0",
  "unit": "blocks",

  "numbered": true,
  "contents": true,
  "index": true,

  "cover": {
    "kicker": "[Short kicker line. Example: 'A STEAM-IE curriculum book']",
    "note": "[One sentence about what this book is for]"
  },
  "copyright": {
    "year": 2026,
    "rights": "© 2026 [Your Name]. All rights reserved.",
    "lines": [
      "Set in Space Grotesk, Inter and JetBrains Mono.",
      "Built with the paper engine: github.com/hassancs91/paper-engine"
    ]
  },

  "parts": [
    {
      "name": "Science",
      "eyebrow": "S",
      "why": "[One sentence. Why does understanding the science come first?]",
      "blocks": []
    },
    {
      "name": "Technology",
      "eyebrow": "T",
      "why": "[One sentence. How do the tools apply what the science taught?]",
      "blocks": []
    },
    {
      "name": "Engineering",
      "eyebrow": "E",
      "why": "[One sentence. What are we building and why?]",
      "blocks": []
    },
    {
      "name": "Arts",
      "eyebrow": "A",
      "why": "[One sentence. How does good design change the outcome?]",
      "blocks": []
    },
    {
      "name": "Mathematics",
      "eyebrow": "M",
      "why": "[One sentence. What do the numbers tell us?]",
      "blocks": []
    },
    {
      "name": "Innovation",
      "eyebrow": "I",
      "why": "[One sentence. What can we change to make this work in our own context?]",
      "blocks": []
    },
    {
      "name": "Entrepreneurship",
      "eyebrow": "IE",
      "why": "[One sentence. Why does the business matter as much as the science?]",
      "blocks": []
    }
  ],

  "editions": {
    "free": []
  }
}
```

---

## STEAM-IE Workflow Summary

After you confirm the page list:

**Phase 1 — Define the topic, audience, and end goal.**
You do this in the prompt above.

**Phase 2 — I propose the STEAM-IE page breakdown.**
One table per STEAM-IE letter, showing block title, description, and band type.

**Phase 3 — You confirm and narrow.**
Tell me which pages to write first. Keep the rest in the backlog.

**Phase 4 — I draft all words, no building yet.**
All pages presented as plain text, grouped by STEAM-IE letter. Your edits are law.

**Phase 5 — You edit.**
Change wording, merge pages, swap bands, add constraints.

**Phase 6 — I build everything in one pass.**
Write all pages to the interior file. Add all titles to book.json. Run the build loop. Read and show you the screenshots.

---

## Adapting STEAM-IE for Any Topic

STEAM-IE is not topic-specific. The framework applies to any technology or practice.

| STEAM-IE Letter | Focus | Always answers |
|---|---|---|
| **S** Science | The why | How does this work? What are the underlying principles? |
| **T** Technology | The tools | What equipment or systems make this possible? |
| **E** Engineering | The build | How is this constructed and assembled? |
| **A** Arts | The look | How does good design make this better or more appealing? |
| **M** Mathematics | The measure | What can we calculate? What are the numbers? |
| **I** Innovation | The new | What can we change to make this work in our own context? |
| **E** Entrepreneurship | The business | How do we turn this into a viable business? |

The content inside each letter changes with the topic. The structure stays the same.

---

## Key Principles

| Principle | Why it matters |
|---|---|
| **Order is load-bearing** | Science builds vocabulary for Technology. Skipping order leaves students without the mental model for what the tools are doing. |
| **Innovation comes after Mathematics** | Students need the baseline numbers before they can improve on them. |
| **Entrepreneurship closes the loop** | A book that teaches students to build something they cannot sell is only half a STEAM-IE book. |
| **Colour is signal, not decoration** | The section colour appears in three consistent places on every page. The reader knows where they are without reading a word. |
| **Local specifics belong in the prompt** | Tell me the currency, local materials, nearby markets, and audience context. Every page reflects the real world the students will work in. |
| **One confirmation gate before building** | You approve the page list. Then you approve the drafts. Only then does anything get written to disk. |
