# STEAM-IE Framework Reference (new-idea Skill)

The STEAM-IE framework structures every book into 7 chapters (sections), each with a distinct focus, color, and page types.

---

## The 7 Sections

| Letter | Section | Eyebrow | Hex Color | Core Focus |
|--------|---------|---------|-----------|------------|
| **S** | Science | S | `#e61358` | Core natural, chemical, biological, or physical principles powering the process |
| **T** | Technology | T | `#ed7d1f` | Monitoring tools, hardware, software, sensors, meters, instruments |
| **E** | Engineering | E | `#a0c82f` | Physical assembly, structural framing, piping, spatial layout, maintenance |
| **A** | Arts | A | `#32b5d3` | Visual layout, ergonomics, lighting, branding, packaging, worker experience |
| **M** | Mathematics | M | `#b44b97` | Yield metrics, unit economics, cost per unit, break-even, calendars |
| **I** | Innovation | I | `#306a50` | Local material substitutions, hacks, hybrid systems, off-grid workarounds |
| **IE** | Entrepreneurship | IE | `#5441ff` | Target buyer segments, pricing, cash flow, startup capital, records |

---

## Section Details

### S — Science
**Question it answers:** *What natural principles make this work?*
- Physics, chemistry, biology fundamentals
- Why the process works at molecular/thermodynamic level
- **Page types**: Mostly diagrams (processes, curves, cross-sections)
- **Example pages**: "Moisture Equilibrium", "Solar Irradiance", "Natural Convection"

### T — Technology
**Question it answers:** *What tools and instruments do you need?*
- Sensors, meters, controllers, hardware
- Selection criteria, calibration, maintenance
- **Page types**: Mix of photos (physical devices) and diagrams (schematics)
- **Example pages**: "Low-Power 12V DC Fans", "Digital Hygrometers", "IoT Airflow Sensors"

### E — Engineering
**Question it answers:** *How do you build the physical system?*
- Construction, framing, piping, spatial layout
- Structural details, connections, maintenance access
- **Page types**: Mostly diagrams (architectural, exploded views)
- **Example pages**: "Solar Thermal Collector Design", "Cabinet Construction", "Drainage & Overflow"

### A — Arts
**Question it answers:** *How do you design for humans?*
- Ergonomics, visual layout, lighting, branding
- Worker experience, packaging, display
- **Page types**: Mix of photos (finished setups) and diagrams (layouts)
- **Example pages**: "Ergonomic Working Height", "Fruit Slicing Aesthetics", "Eco-Branding"

### M — Mathematics
**Question it answers:** *What are the numbers?*
- Unit economics, cost per unit, break-even
- Yield calculations, calendars, depreciation
- **Page types**: Diagrams (charts, tables, formulas)
- **Example pages**: "Calculating Dryer Sizing", "Thermal Collector Efficiency", "Break-Even Point"

### I — Innovation
**Question it answers:** *What local adaptations work?*
- Material substitutions, hacks, hybrid systems
- Off-grid workarounds, local sourcing
- **Page types**: Mix (local material photos, system diagrams)
- **Example pages**: "Local Material Swaps", "Biomass Auxiliary Heating", "Solar-Thermal Curing"

### IE — Entrepreneurship
**Question it answers:** *How does this become a business?*
- Buyer identification, pricing, cash flow
- Startup capital, records, compliance
- **Page types**: Diagrams (business models, cash flows)
- **Example pages**: "Identifying B2B Buyers", "Quality Assurance", "Cash Flow Management"

---

## Page Distribution Guidelines

### Typical Book (30–50 pages)
| Section | Min Pages | Typical | Max Pages |
|---------|-----------|---------|-----------|
| Science | 3 | 6 | 8 |
| Technology | 3 | 6 | 8 |
| Engineering | 3 | 6 | 8 |
| Arts | 3 | 5 | 7 |
| Mathematics | 3 | 5 | 7 |
| Innovation | 3 | 5 | 7 |
| Entrepreneurship | 3 | 5 | 7 |

### Free Sample Pages
- Usually 2–4 pages total
- Standard: First Science page + first Entrepreneurship page
- Can be customized per book

---

## Page Structure (Per STEAM-IE Page)

Every page follows this exact structure:

```
STEAM-IE · No. [02-digit] [Section Name]
# [Action-Oriented Title]
#### [1-Sentence Subtitle Explaining Core Hook]

![AI Image Prompt: Detailed visual description for diagram or photo]

[3-5 short, direct paragraphs explaining "Why" and "How" using plain language and analogies.]

```
[ACTION CALLOUT: LABEL] 1-2 sentences specifying a concrete, immediate hands-on task.
```
```

### Required Elements
1. **Header**: `STEAM-IE · No. DD Section` (eyebrow + page number + section)
2. **Title**: Action-oriented, single concept
3. **Subtitle**: One sentence, core hook/problem
4. **Image Prompt**: Explicit AI prompt (diagram or photo)
5. **Explainer**: 3-5 short paragraphs, "Let's say..." opening
6. **Action Callout**: Label + concrete task
7. **Citations**: Numbered references (optional)

---

## Colour System in Diagrams

Every SVG diagram uses the section's hex code as **primary fill/stroke** for the concept being taught:

| Role | Use For | Fill | Stroke | Title Text |
|------|---------|------|--------|------------|
| Neutral | Your system, structural boxes | `#FFFFFF` | `#E7E9EF` | `#1A1A2E` |
| Mechanism (Indigo) | The thing being taught | `#EEF0FE` | `#D5D8FA` | `#4F46E5` |
| Good (Teal) | Desired outcome | `#ECFBF7` | `#CDEFE8` | `#0D9488` |
| Threat/Bad (Red) | Attacker, failed outcome | `#FEF1F1` | `#F8D6D6` | `#DC2626` |
| Sensitive (Amber) | Valuable thing protected | `#FDF6E8` | `#E7E9EF` | `#B45309` |

- **Arrows**: Neutral slate `#94A3B8` (only "bad" arrow = red `#DC2626`)
- **Trust boundary**: Dashed `#CBD2DC`
- **Every `<text>`**: Explicit `fill` and `font-family` in inline style

---

## Image Type Classification

### Photo (Physical Subject)
- Fruit, plant, vegetable, tool, equipment
- Building, construction, cabinet, tray, panel, device
- Finished product, harvest, person working
- **Prompt keywords**: `photograph`, `photo of`, `real`, `physical`, `actual`

### Diagram (Mechanism/Process)
- Process, airflow, heat transfer, equation
- System architecture, before/after, vector illustration
- Technical drawing, cross-section, business model
- **Prompt keywords**: `diagram`, `schematic`, `chart`, `flow`, `process`, `system`, `architecture`, `vector`, `blueprint`, `cross-section`

**Heuristic fallback**: Physical objects → `photo`; Otherwise → `diagram`

---

## Action Callout Labels

Standardized labels (use consistently):
- `DO THIS TODAY` — Immediate hands-on task
- `MEASURE IT` — Data collection/observation
- `BUILD THIS ONCE` — One-time construction
- `DO THE MATH` — Calculation/verification
- `TRY THIS WEEK` — Weekly experiment
- `DESIGN THIS WEEK` — Planning task
- `BUILD THIS WEEKEND` — Weekend project
- `OBSERVE TODAY` — Immediate observation

---

## Writing Voice (Per Section)

All sections share the same voice (see `voice-style.md`):
- **Opening**: "Let's say..." + concrete situation
- **Contractions**: Yes ("it's", "you're", "can't")
- **No em dashes**: Use commas or periods
- **Simple words**: "fetches" → "gets", "credentials store" → "hidden file with keys"
- **Concrete beats abstract**: Real addresses, real feature names
- **Closer**: One sticky sentence at end
- **Color roles in text**: `.bad` (red=problem), `.hl` (indigo=mechanism), `.good` (teal=outcome)

---

## Book Metadata Fields

| Field | Source | Used In |
|-------|--------|---------|
| `title` | User input | Cover, spine, PDF metadata |
| `slug` | Derived/User | Folder name, file names |
| `subtitle` | User input | Cover, metadata |
| `author` | User input | Copyright, cover |
| `series` | User input | Eyebrow, footer |
| `editionLabel` | User/auto | Cover, colophon |
| `audience` | User input | VOICE.md, marketing |
| `primaryLocation` | User input | Localization, examples |
| `coverImage` | User/auto | Cover page, PDF |