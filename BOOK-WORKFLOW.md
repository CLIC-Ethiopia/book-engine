---
name: book-workflow-guide
description: How to write one page, a batch of pages, or a whole new book using the paper engine block skill
metadata:
  type: reference
---

# Book Writing Workflow

How to use the block skill to write one page, a batch of pages, or an entirely new book — with sample prompts and step-by-step workflows.

---

## Part 1 — Writing One Page (The Block Skill)

The `/block` skill handles a single page. This is the default loop.

### Step 0 — Ask if you have your own take

Before writing anything, I ask: do you have a rough draft, a specific wording, a story, or a take you want on this page? If you give me something, that is the primary material. I build the page around it and keep your wording verbatim.

If you say "just go" or "no", I write from `blocks.md`.

### Step 1 — I read three files

1. `books/<slug>/blocks.md` — what this page is about
2. `books/<slug>/VOICE.md` — how this book sounds (this is law)
3. `books/<slug>/book.json` — the chrome (series label, brand, whether pages are numbered)

### Step 2 — Draft the words, then stop

I write and present, as plain text:

- **title** — the concept, short. An acronym stays uppercase.
- **subtitle** — one line saying what it means, or expanding the acronym.
- **explainer** — the "Let's say…" opening, the real cost, the mechanism, the closer.
- **action** — the one thing to go and do, and the label for its box.
- **band plan** — which shape (for a diagram) or photo description (for a photo).

Then I stop. **Your edits are law.** Use your wording verbatim, fix only real typos, never improve your phrasing.

### Step 3 — Build the page

1. Copy one `.bb` section from `references/example-page.html` into `books/<slug>/<slug>.html`.
2. Write the band. Diagram: inline SVG. Photo: generate with `engine/tools/gen-image.mjs` or use one you supply.
3. Write the explainer with the role colours as emphasis spans:
   - `.bad` red for the pain or threat
   - `.hl` indigo for the idea being taught
   - `.good` teal for the good outcome
   - `strong` for a key phrase
   End with `<p class="close">`.
4. Write the action box from the block's Action line.
5. Add the page's title to its part in `book.json`.

### Step 4 — Verify

```bash
node engine/tools/build-book.mjs books/<slug>
node engine/tools/check.mjs      books/<slug>/book.html
node engine/tools/shot.mjs       books/<slug>/book.html
```

`check.mjs` must read `0 mm` on every page. Then **open and read the PNGs** — a page is not done until you have looked at it.

---

## Part 2 — Writing Multiple Pages at Once

### The Pattern

The skill is the same. The loop is the same. The only difference is that I repeat the draft-and-present step for every page before building any of them.

**One concept per page is a hard rule.** The system cannot produce a single page that covers a broad topic. If your brief is wide, I decompose it into narrow pages and you confirm the split before I write anything.

### Sample Prompt: Vertical Farming Book

Paste this when you want to add a batch of pages to an existing book:

```
I want to create multiple pages for my Fad Lab book. Here is my topic:

Vertical Farming Business — a practical guide for students on how to build
and run a small greenhouse that grows vegetables for sale using hydroponics
and LED grow lights.

Please propose a page breakdown covering these concepts. For each page,
give me the block title, category, band type (diagram or photo), and
the four block lines (What, Use when, Action, Band):

1. Intro to hydroponics — the core idea, what it replaces, why it matters
2. Soil as physical support only — why soil alone without nutrient
   provides no food to plants
3. Seed germination — how seeds are started before transplanting into
   the hydroponic system
4. Nutrient delivery — how dissolved minerals reach plant roots in solution
5. Water circulation — how the system moves water through the growing channels
6. LED grow lights — how artificial light replaces sunlight, spectrum and
   timing considerations
7. Selling the harvest — basic market channels for fresh greens (restaurants,
   farmers markets, direct sales)
8. Engineering the vertical racks — how to design and space the multi-level
   structures inside the greenhouse
9. [Open — please suggest one more page that fits this sequence]

After you propose the list, I will confirm which pages to write first
and in what order. Then write all the pages I select in one pass,
show me the drafts, wait for my edits, and build the book when I say so.
```

### What happens next

**Phase 1 — I propose the decomposition**

I read your three files (`blocks.md`, `VOICE.md`, `book.json`) and return a table:

| # | Block Title | Category | Band | What (one-liner) | Action (one-liner) |
|---|---|---|---|---|---|
| 1 | Intro to Hydroponics | Agriculture · photo | photo | Soilless growing where roots sit directly in nutrient-rich water | Build a small DWC bucket with one lettuce plant and observe root growth over two weeks |
| 2 | Soil as Physical Support | Agriculture · diagram | diagram | Soil anchors roots and retains water but contains no plant food without added fertilizer | Dig up a plant from plain garden soil. Show students the difference between soil with and without nutrient solution |
| 3 | Seed Germination | Agriculture · diagram | diagram | Seeds are sprouted on a moist medium before transplanting to hydroponic channels | Place ten seeds on a damp paper towel in a sealed bag. Check daily. Transplant when roots are 2–3 cm |
| 4 | Nutrient Delivery | Agriculture · diagram | diagram | Concentrated minerals dissolve in water and are absorbed directly by exposed roots | Mix a nutrient solution following package instructions. Test EC with a meter. Top up reservoir every three days |
| 5 | Water Circulation | Agriculture · diagram | diagram | A pump moves nutrient solution from a reservoir through channels and back in a closed loop | Install a submersible pump. Time how long it takes to fill a 10-liter reservoir. Adjust flow rate per channel |
| 6 | LED Grow Lights | Agriculture · diagram | diagram | LEDs emit specific light spectrum wavelengths that drive photosynthesis, replacing natural sunlight | Hang one LED panel 30 cm above seedlings. Run 18 hours on, 6 hours off. Compare growth to a windowsill control |
| 7 | Selling Fresh Greens | Business · diagram | diagram | Fresh harvested greens reach buyers through direct sales, restaurants, and farmers markets | Visit one local restaurant. Ask the chef what greens they buy, in what quantities, and at what price |
| 8 | Engineering the Racks | Engineering · diagram | diagram | Vertical racks are spaced and angled to allow light penetration, airflow, and easy access for harvesting | Sketch a two-tier rack layout for a 3 m x 6 m greenhouse. Label channel spacing, walk path, and light panel position |
| 9 | pH Balancing *(suggested)* | Agriculture · diagram | diagram | Nutrient solution acidity controls which minerals plants can absorb; pH drifts as plants take up ions | Check reservoir pH daily with a meter. Adjust with pH Up or Down solution to keep range 5.5–6.5 |

**Phase 2 — You confirm**

Reply with something like:

```
Write pages 1, 3, 4, and 5 first. Keep the rest in the backlog.
Use the suggested pH page as number 9.
```

Or edit the table — change a title, drop one, add your own, reorder.

**Phase 3 — I draft all words, no building yet**

For each confirmed page, I write the title, subtitle, explainer, action box, and band plan. I present all drafts in one message. Nothing is written to disk yet.

**Phase 4 — You edit**

You review all drafts. You might say:

```
Page 3: change "2–3 cm" to "1–2 inches" — my students are in Ethiopia
Page 5: the action should also mention checking for clogs weekly
Page 1: use my image instead of generating one, I will upload it later
```

I use your wording exactly. No upgrades.

**Phase 5 — I build everything in one pass**

After you say "build it":

1. Write all `<section class="sheet bb">` blocks into `books/<slug>/<slug>.html`
2. Add all page titles to the appropriate `part` in `book.json`
3. If any page has a photo, generate it with `engine/tools/gen-image.mjs` and save the prompt next to it as `<name>.txt`
4. Run the build loop once:
   ```bash
   node engine/tools/build-book.mjs books/<slug>
   node engine/tools/check.mjs      books/<slug>/book.html
   node engine/tools/shot.mjs       books/<slug>/book.html
   ```
5. Read all new screenshots and show them to you

### General Template Prompt (for any future topic)

Copy this whenever you want to add a batch of pages:

```
I want to create multiple pages for my [book name] book.

Topic: [one sentence describing the subject]

Here are the concepts I want to cover:
1. [concept and any specifics — e.g., "must use a photo, not a diagram"]
2. [concept]
3. [concept]
...
[N]. [or say "please suggest additional pages that fit this sequence"]

Constraints:
- [any image preferences, e.g., "I will supply my own photos"]
- [any audience specifics, e.g., "students in Ethiopia"]
- [anything else, e.g., "I want pages 1–4 written first"]

After you propose the page list, I will confirm which pages to write
and in what order. Write all drafts, show me, wait for my edits,
then build when I say so.
```

---

## Part 3 — Creating a Brand New Book

This is for when you want a book that is entirely separate from `fadlab-book` — its own title, its own voice, its own structure. The showcase book and the starter book are examples of this.

### Step 1 — Bootstrap the book folder

Copy the entire `books/starter/` folder and rename it to your book's slug. The slug is the lowercase, hyphenated name that becomes the URL and folder name.

```
books/starter/  →  books/my-new-book/
```

Inside your new folder you will have:

```
my-new-book/
  book.json       ← your metadata (title, author, series, brand, parts)
  VOICE.md        ← your book's tone and style rules
  blocks.md       ← your page backlog
  <slug>.html     ← your interior source file (the one page you start with)
  images/         ← (create this) photos go here
```

### Step 2 — Edit book.json

This is the most important file. It drives the cover, the table of contents, the part dividers, and the footer.

```json
{
  "title": "My New Book Title",
  "subtitle": "One clear sentence about what this book is.",
  "author": "Your Name",

  "series": "Your Series Name",
  "brand": "yourdomain.com",
  "editionLabel": "Edition 1.0",
  "unit": "blocks",

  "numbered": true,
  "contents": true,
  "index": true,

  "cover": {
    "kicker": "A paper-engine book",
    "note": "One idea per page, one page at a time."
  },
  "copyright": {
    "year": 2026,
    "rights": "© 2026 Your Name. All rights reserved.",
    "lines": [
      "Set in Space Grotesk, Inter and JetBrains Mono.",
      "Built with the paper engine: github.com/hassancs91/paper-engine"
    ]
  },

  "parts": [
    {
      "name": "Your first part",
      "eyebrow": "A short label",
      "why": "One sentence explaining why these pages belong together.",
      "blocks": []
    }
  ],

  "editions": {
    "free": []
  }
}
```

**Fields explained:**

| Field | What it does |
|---|---|
| `title` | The full book title, shown on the cover and in the PDF metadata |
| `subtitle` | One line under the title on the cover |
| `author` | Your name, shown on the cover |
| `series` | Short label in the page eyebrow and footer (e.g., "Fad Lab") |
| `brand` | Shown in the page footer, e.g., your website |
| `editionLabel` | Shown on the copyright page |
| `numbered` | `true` adds page numbers to every page |
| `contents` | `true` generates a table of contents after the cover |
| `index` | `true` generates an index at the back of the book |
| `parts[].name` | The part name shown on part-divider pages |
| `parts[].eyebrow` | A short category label above the part name |
| `parts[].why` | One sentence on the part-divider page explaining the connection |
| `parts[].blocks` | Array of page titles — these are the pages in this part |
| `editions.free` | Titles of pages available as free samples |

### Step 3 — Edit VOICE.md

This file controls how the book sounds. It is the most personal part of the book. Rewrite every section in your own voice, for your specific audience.

Key things to decide:

- **Who is reading?** (e.g., "students in Ethiopia with no prior greenhouse experience")
- **What tone?** (e.g., "dry and practical", "encouraging and step-by-step")
- **What contractions?** (always allowed — they keep voice human)
- **What label for the action box?** (e.g., "TRY THIS WEEKEND", "DO THIS TODAY", "ASK YOUR AI")
- **What voice examples?** (replace the cooking and coding examples with examples from your domain)

See `books/showcase/VOICE.md` for a fully rewritten example and `books/starter/VOICE.md` for the default template with explanations.

### Step 4 — Edit blocks.md

Delete the template content. Add your first page as a draft entry.

```
#### My First Page
<Category> · <diagram|photo>
- **What:**
- **Use when:**
- **Action:**
- **Band:**
```

See Part 1 and Part 2 of this guide for how to write good block lines.

### Step 5 — Edit the interior HTML file

Rename the file from `starter.html` to `<slug>.html` and edit the `<title>` tag inside it.

Delete the template page inside `<main class="deck">` and replace it with one empty `.bb` section:

```html
<section class="sheet bb">
  <!-- Your first page goes here -->
</section>
```

### Step 6 — Run the first build

```bash
node engine/tools/build-book.mjs books/my-new-book
node engine/tools/check.mjs      books/my-new-book/book.html
node engine/tools/shot.mjs       books/my-new-book/book.html
```

This generates the cover, the copyright page, the table of contents, your empty first page, and the index (if enabled). Read the screenshot to confirm the chrome looks right before adding real content.

### Step 7 — Add pages

Now your book exists. Use the prompts and workflows in Part 1 or Part 2 of this guide to add pages.

---

## Key Principles

| Principle | Why it matters |
|---|---|
| **You lead, I follow** | I never invent page titles or concepts. I propose from your brief and you confirm before I write. |
| **Draft first, build second** | Seeing the words before they are locked into HTML lets you catch bad wording cheaply. |
| **One confirmation gate before building** | You approve the page list. Then you approve the drafts. Only then does anything get written to disk. |
| **Batch by review comfort** | Four to six pages per review round is easier to absorb than fifteen at once. |
| **The skill does not change** | The block skill handles one page or ten, one book or five — same files, same loop, same checks. |
| **book.html is always generated** | Never hand-edit book.html. Always edit the interior file and rebuild. |
| **Colour is a role, not decoration** | Red for pain or threat. Indigo for the idea being taught. Teal for the good outcome. Neutral for the reader's own app or self. |
| **Never invent a fact, number, study, or story** | If you did not provide it or verify it, I do not write it. |

---

## Quick Reference — Commands

```bash
# Build the book (assembles book.html from the interior file)
node engine/tools/build-book.mjs books/<slug>

# Check the book (must show 0 mm on every page, no broken images)
node engine/tools/check.mjs books/<slug>/book.html

# Take screenshots (generates page1.png, page2.png, etc.)
node engine/tools/shot.mjs books/<slug>/book.html

# Generate a photo (requires agy CLI signed in, or GEMINI_API_KEY)
node engine/tools/gen-image.mjs "<prompt>" out.png [--aspect 3:2]
node engine/tools/gen-image.mjs --prompt-file p.txt out.jpg --ref style.jpg
```

## Quick Reference — File Map

```
books/<slug>/
  book.json       ← metadata, parts, page titles (edit this)
  VOICE.md        ← tone and style rules (edit this)
  blocks.md       ← page backlog (edit this)
  <slug>.html     ← interior source with one .bb section per page (edit this)
  book.html       ← GENERATED — never edit this
  images/         ← photos go here (create if missing)
    <name>.png    ← the image
    <name>.txt   ← the prompt that made it (auto-saved)
```

---

## Part 4 — STEAM-IE Curriculum Books

### What STEAM-IE Is

STEAM-IE stands for **Science, Technology, Engineering, Arts, Mathematics, Innovation, and Entrepreneurship**. It is a curriculum format for training African innovators and entrepreneurs. Each letter can contain multiple pages, and the letters are ordered intentionally:

| Letter | Focus | What the pages teach |
|--------|-------|---------------------|
| **S** Science | The why | How plants grow, how water moves, how light fuels life |
| **T** Technology | The tools | LED grow lights, pumps, sensors, climate control systems |
| **E** Engineering | The build | Greenhouse construction, rack design, water channel routing |
| **A** Arts | The look | Design principles for the greenhouse, creative problem-solving |
| **M** Mathematics | The measure | Yield per square meter, cost per plant, profit margins |
| **I** Innovation | The new | Alternative techniques, local adaptations, creative leaps |
| **E** Entrepreneurship | The business | Pricing, finding buyers, managing cash flow, raising funds |

The intent is that a reader moves from understanding the science of a topic, to the tools that apply it, to building it, to making it beautiful, to measuring it, to improving it, and finally to selling it. The order builds a complete thinker.

---

### How STEAM-IE Maps Onto book.json

The seven letters of STEAM-IE become seven `parts` in `book.json`. Each part holds the pages that belong to that letter.

```json
{
  "parts": [
    {
      "name": "Science",
      "eyebrow": "S",
      "why": "Before you grow anything, understand how growing works.",
      "blocks": ["Photosynthesis", "Water uptake", "Soil science"]
    },
    {
      "name": "Technology",
      "eyebrow": "T",
      "why": "The tools that replace what nature does for free.",
      "blocks": ["LED grow lights", "Water pumps", "pH sensors"]
    },
    {
      "name": "Engineering",
      "eyebrow": "E",
      "why": "Building the structure that holds the system.",
      "blocks": ["Greenhouse frame", "Vertical racks", "Channel routing"]
    },
    {
      "name": "Arts",
      "eyebrow": "A",
      "why": "Good design makes a greenhouse that people want to work in.",
      "blocks": ["Space layout", "Visual design", "Colour and light"]
    },
    {
      "name": "Mathematics",
      "eyebrow": "M",
      "why": "Numbers tell you whether the business works before you build it.",
      "blocks": ["Yield per square meter", "Cost per plant", "Break-even analysis"]
    },
    {
      "name": "Innovation",
      "eyebrow": "I",
      "why": "What you change to make this work in your own context.",
      "blocks": ["Local materials", "Aquaponics hybrid", "Solar power"]
    },
    {
      "name": "Entrepreneurship",
      "eyebrow": "IE",
      "why": "The science is useless if nobody pays for the harvest.",
      "blocks": ["Finding buyers", "Pricing your greens", "Cash flow management"]
    }
  ]
}
```

Note that the last letter (IE) reuses the eyebrow from the acronym itself. This is intentional. The part-divider pages between each letter carry the `why` sentence, which becomes the transition that connects each STEAM-IE section to the next.

---

### Sample Prompt: STEAM-IE Hydroponics Book

Paste this when you want to create a new STEAM-IE book:

```
I want to create a STEAM-IE curriculum book. Here is my topic:

Hydroponics and Vertical Farming — teaching students how to build and run
a small greenhouse that grows vegetables for sale using hydroponics,
LED grow lights, and vertical racks.

I want the book to follow the STEAM-IE format with seven sections:

S — Science: the plant science and environmental science behind growing
T — Technology: the tools (LED lights, pumps, sensors) used in the system
E — Engineering: the construction of the greenhouse, racks, and water system
A — Arts: design principles for the greenhouse space and layout
M — Mathematics: yield calculations, cost analysis, and profit margins
I — Innovation: local adaptations and creative improvements
E — Entrepreneurship: selling the harvest and running the business

Please propose a full page breakdown. For each STEAM-IE section, list the
pages I need. For each page give me the block title, a one-line description
of what it covers, and the band type (diagram or photo).

I will confirm which pages to write first. Write all drafts, show me,
wait for my edits, then build when I say so.
```

### Sample STEAM-IE Page Breakdown (Hydroponics)

After you send that prompt, I would return something like this:

**S — Science**

| # | Block Title | Description | Band |
|---|---|---|---|
| S1 | How plants drink | Capillary action and root absorption in plain water | diagram |
| S2 | What light feeds | Photosynthesis and the wavelengths plants need | diagram |
| S3 | Water chemistry | pH, dissolved oxygen, and why both matter | diagram |
| S4 | The nutrient solution | Macronutrients and micronutrients plants draw from water | diagram |
| S5 | Temperature and growth | How heat affects plant metabolism and yield | diagram |

**T — Technology**

| # | Block Title | Description | Band |
|---|---|---|---|
| T1 | LED grow lights | Full spectrum, red and blue diodes, and timing | diagram |
| T2 | The water pump | Submersible pumps, flow rate, and head pressure | diagram |
| T3 | pH and EC meters | Measuring acidity and nutrient concentration | photo |
| T4 | Timers and controllers | Automating lights and watering cycles | diagram |
| T5 | Climate sensors | Tracking temperature, humidity, and light levels | diagram |

**E — Engineering**

| # | Block Title | Description | Band |
|---|---|---|---|
| E1 | The greenhouse frame | PVC, steel, or wood: materials and load calculation | diagram |
| E2 | Vertical rack design | Spacing tiers for light penetration and access | diagram |
| E3 | Channel routing | How water moves from reservoir through every growing channel | diagram |
| E4 | Drainage and overflow | Preventing flooding when pumps fail | diagram |
| E5 | Ventilation basics | Airflow through the greenhouse without losing humidity | diagram |

**A — Arts**

| # | Block Title | Description | Band |
|---|---|---|---|
| A1 | Layout and flow | Designing the walk path through the growing space | diagram |
| A2 | Light as design | Using light quality to make the space inviting to work in | diagram |
| A3 | Colour in the greenhouse | How plant colour signals health and guides the eye | diagram |
| A4 | Branding the harvest | What a good label says and how it builds trust | diagram |

**M — Mathematics**

| # | Block Title | Description | Band |
|---|---|---|---|
| M1 | Plants per square meter | Rack spacing and channel density calculations | diagram |
| M2 | Cost per plant | Seeds, nutrients, water, light, and labour divided by yield | diagram |
| M3 | Break-even analysis | How many heads of lettuce to sell before you profit | diagram |
| M4 | Harvest calendar | Mapping grow cycles to sales cycles | diagram |

**I — Innovation**

| # | Block Title | Description | Band |
|---|---|---|---|
| I1 | Local materials | Replacing imported parts with what you can find nearby | diagram |
| I2 | Aquaponics hybrid | Adding fish to the nutrient loop for fertilizer and income | diagram |
| I3 | Solar power | Running pumps and lights off-grid | diagram |
| I4 | Floating rafts | Adapting DWC for shallow channels | diagram |

**E — Entrepreneurship**

| # | Block Title | Description | Band |
|---|---|---|---|
| E1 | Finding buyers | Restaurants, markets, shops, and direct sales | diagram |
| E2 | Pricing your greens | Setting prices that cover costs and beat the market | diagram |
| E3 | Cash flow management | Tracking money in and money out, week by week | diagram |
| E4 | Raising startup funds | Grants, loans, and pre-selling the harvest | diagram |
| E5 | Record keeping | What to write down and why it matters for the next season | diagram |

Total: 31 pages across 7 STEAM-IE sections.

---

### STEAM-IE Workflow

**Phase 1 — Define the topic and the audience**

Before anything else, establish:

- What is the central technology or practice? (e.g., hydroponics, solar cooking, beekeeping)
- Who is reading? (e.g., vocational students in Ethiopia, ages 16–22, no prior science background)
- What is the end goal of the book? (e.g., students build and sell from their own small greenhouse)

This shapes every page. A book for advanced engineers skips the basics. A book for beginners with no equipment assumption starts at the beginning.

**Phase 2 — Map the STEAM-IE structure**

For each letter, decide:

- How many pages does each letter need?
- Are there pages that belong to more than one letter? (e.g., LED lights could be Technology or Science — pick the one where the explainer leads)
- Which pages are free samples? (the `editions.free` list in book.json)

Send me the STEAM-IE prompt. I return the full breakdown table. You confirm, edit, and narrow the list to what you want written first.

**Phase 3 — Draft by section, not by individual page**

I draft all pages in a STEAM-IE section together, because the `why` sentence on the part-divider page needs to connect the pages that follow it. Writing the Science pages as a group lets me make sure they build on each other in the right order.

Present all drafts in one message, grouped by STEAM-IE letter. You review by section.

**Phase 4 — You edit**

Same rule as before: your wording is law. You might say:

```
Science section: pages 3 and 4 are too similar — merge them into one
Technology section: add a page on DIY sensors from local parts
Mathematics section: change all examples to Ethiopian birr, not dollars
Innovation section: drop the solar page, too advanced for this cohort
```

**Phase 5 — Build and verify by section**

After you say "build it", I write all sections to the interior file, add all titles to book.json, and run one build. Then I read and show you the screenshots, section by section.

---

### General Template Prompt: Any STEAM-IE Topic

```
I want to create a STEAM-IE curriculum book.

Topic: [one sentence on the central technology or practice]

Audience: [who is reading, their background, their goals]

End goal of this book: [what the reader should be able to do by the end]

Here is my STEAM-IE outline. For each letter, I want roughly this many pages:
- S — Science: [list concepts or say "I need N pages, please suggest topics"]
- T — Technology: [list or say "please suggest"]
- E — Engineering: [list or say "please suggest"]
- A — Arts: [list or say "please suggest"]
- M — Mathematics: [list or say "please suggest"]
- I — Innovation: [list or say "please suggest"]
- E — Entrepreneurship: [list or say "please suggest"]

Constraints:
- [any local specifics — e.g., "costs in Ethiopian birr", "available local materials"]
- [any pages that must use photos vs diagrams]
- [which STEAM-IE section to write first]

Please propose the full page list across all seven sections.
I will confirm which pages to write first.
Write all drafts, show me by section, wait for my edits, build when I say so.
```

---

### STEAM-IE VOICE.md Additions

When you rewrite VOICE.md for a STEAM-IE book, add this section to it. It tells me how to handle the transitions between STEAM-IE letters.

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
bridging work. Example: moving from Engineering to Arts, the divider might
say "It works. Now make it worth working in."
```

---

### Adapting STEAM-IE for Any Topic

STEAM-IE is not only for hydroponics. The framework applies to any technology or practice. Here is how it maps across three common topics:

| STEAM-IE Letter | Hydroponics | Solar Cooking | Beekeeping |
|---|---|---|---|
| **S** Science | How plants absorb water | How heat transfers through metal | How bees pollinate |
| **T** Technology | LED lights, pumps | Solar panel, thermal mass | Hive frames, smoker |
| **E** Engineering | Rack construction | Box design, orientation | Frame arrangement |
| **A** Arts | Layout and light quality | Aesthetics of the cooking unit | The look of a healthy hive |
| **M** Mathematics | Yield per square meter | Cost per meal cooked | Honey per hive per season |
| **I** Innovation | Aquaponics hybrid | Wind-gyre assist | Local bee species |
| **E** Entrepreneurship | Selling at market | Selling saved fuel time | Selling honey and wax |

The letters stay the same. The content inside each letter changes to match the topic. That is the power of STEAM-IE: once you understand the framework, you can apply it to any subject you are teaching.

---

### Key Principles for STEAM-IE Books

| Principle | Why it matters in STEAM-IE |
|---|---|
| **Order is load-bearing** | The Science pages build the vocabulary the Technology pages use. Skipping the order means students lack the mental model for what the tools are doing. |
| **Every STEAM-IE letter earns its place** | If a letter has fewer than two pages, ask whether its content is better placed in an adjacent letter. |
| **The Entrepreneurship section closes the loop** | A book that teaches students to build something they cannot sell is only half a STEAM-IE book. |
| **Innovation lives at the end by design** | Students need to understand the baseline before they can improve it. The I section comes after M for this reason. |
| **Local specifics belong in the prompt** | Ethiopian birr, local materials, nearby markets. Tell me in the brief and every page reflects the real context the students will work in. |
| **One STEAM-IE letter, one part in book.json** | Each part-divider page carries the `why` sentence that connects the pages within that letter. Do not split a STEAM-IE letter across two parts. |

---

## Part 5 — STEAM-IE Colour System

This section defines the colour each STEAM-IE section uses on its pages. The colours are not decoration. They are a navigation signal: when a student picks up the book at random, the colour of the tab on the left edge tells them which STEAM-IE letter they are looking at, even before they read the title.

### The Colour Palette

| Letter | Section | Hex Code | Where it appears |
|--------|---------|----------|------------------|
| **S** | Science | `#e61358` | Tab bar, eyebrow, part-divider background, diagram accent on Science pages |
| **T** | Technology | `#ed7d1f` | Tab bar, eyebrow, part-divider background, diagram accent on Technology pages |
| **E** | Engineering | `#a0c82f` | Tab bar, eyebrow, part-divider background, diagram accent on Engineering pages |
| **A** | Arts | `#32b5d3` | Tab bar, eyebrow, part-divider background, diagram accent on Arts pages |
| **M** | Mathematics | `#b44b97` | Tab bar, eyebrow, part-divider background, diagram accent on Mathematics pages |
| **I** | Innovation | `#306a50` | Tab bar, eyebrow, part-divider background, diagram accent on Innovation pages |
| **E** | Entrepreneurship | `#5441ff` | Tab bar, eyebrow, part-divider background, diagram accent on Entrepreneurship pages |

---

### Where Each Colour Appears

On every page that belongs to a STEAM-IE section, the section's colour appears in three places:

1. **The left-edge tab** (`<div class="tab">`) — a vertical bar of the section's colour running down the left side of the page. This is the strongest visual signal, visible from across the room.
2. **The eyebrow text** (the small text above the page title) — coloured with the section's hex code. Tells the reader which STEAM-IE letter the page is part of without them having to look up the table of contents.
3. **The diagram accent** — any lines, arrows, or filled shapes that represent the idea being taught on that page use the section's colour as the primary fill or stroke. The diagram's other elements (background, neutral labels) stay neutral so the section colour stays loud.

The page title, the explainer body text, the action box, and the footer stay in the book's neutral palette. The STEAM-IE colour is signal, not decoration.

---

### On Part-Divider Pages

Each STEAM-IE section is introduced by a part-divider page. The divider's background or accent band uses that section's full hex code, making it the most visually distinct page in that section. The divider's text stays in the book neutral so the colour is the only loud element.

---

### How to Tell the Block Skill About Your Colours

When you start a STEAM-IE book, paste this block into the prompt you send me:

```
STEAM-IE Colour System — every page in this book uses the section's colour
in three places: the left-edge tab, the eyebrow text, and the diagram accent.

S — Science:        #e61358
T — Technology:     #ed7d1f
E — Engineering:    #a0c82f
A — Arts:           #32b5d3
M — Mathematics:    #b44b97
I — Innovation:     #306a50
E — Entrepreneurship: #5441ff

Body text, page title, explainer, action box, and footer stay in the
book's neutral palette. The section colour is signal, not decoration.

Every SVG diagram on a STEAM-IE page uses the section's hex code as the
primary fill or stroke for the idea being taught. Other elements in the
diagram (background, neutral labels, secondary lines) stay neutral.
```

---

### What Stays Neutral

These elements use the book's neutral palette on every page, regardless of STEAM-IE section. They keep the book consistent and let the section colour stay loud:

- The page background
- The page title (`<h1 class="title">`)
- The subtitle
- The explainer body text
- The action box background and text
- The page footer
- The neutral labels in any diagram (axis labels, secondary annotations, caption rows)

---

### Adding the Colour System to VOICE.md

When you rewrite VOICE.md for a STEAM-IE book, add this block:

```markdown
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

### Why This Colour System Works

| Principle | What it does |
|---|---|
| **One colour per section** | A student flipping through the book sees seven distinct tabs at the edges of the pages. They can find the section they need without reading any titles. |
| **The colour is in the same place every time** | Tab on the left, eyebrow on the top, accent in the diagram. Predictability makes the colour meaningful rather than decorative. |
| **The neutral palette stays neutral** | Body text, titles, action boxes do not compete with the section colour. The colour carries the signal. |
| **It scales across the whole book** | Adding a new page to a section uses the same colour automatically. No new design decision required. |
| **It survives print** | The hex codes convert cleanly to print colour values. The section signal stays strong on the page and in the PDF. |

---

### Changing the Palette

If you want to change a section's colour later, the change happens in one place: this document. Paste the new hex code here, and tell me in the prompt to update the matching page's tab, eyebrow, and diagram accent. The change applies retroactively to every page in that section on the next build.
