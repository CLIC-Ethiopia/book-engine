# STEAM-IE Voice & Style Guide (new-idea Skill)

Writing rules for all generated content. Based on `gemini_gem_book_engine_instructions_v02.md` and the block skill's `voice.md`.

---

## Core Principles

### Who You're Writing For
One person who is **not an expert**, trying to do a specific thing. They are not reading for pleasure and will not look anything up. The only term allowed to be unfamiliar is the name of the concept itself.

**The goal:** They don't have to already know this; they just have to know it exists.

---

## The Rules

### 1. No Em Dashes. Ever.
Em dashes are the single biggest "a robot wrote this" tell.
- ❌ "The dryer—when properly built—works well."
- ✅ "The dryer, when properly built, works well."
- ✅ "The dryer works well when properly built."

Use commas, periods, or separate sentences.

### 2. Contractions Everywhere
- ✅ "it's", "you're", "can't", "they'll", "isn't", "don't", "won't"
- ❌ "it is", "you are", "cannot", "they will", "is not", "do not", "will not"

Stripping contractions makes text read like a machine.

### 3. Simple Words Only
If a beginner or non-native reader would trip on a word, swap it.

| Instead of | Use |
|------------|-----|
| fetches | gets |
| issues a request | asks for |
| credentials store | hidden file with your keys and passwords |
| instantiates | creates |
| initializes | starts |
| terminates | stops |
| facilitates | helps |
| leverages | uses |
| orchestrates | runs |
| provisioning | setting up |

"Stuff" and "things" are fine. Concrete beats abstract.

### 4. Uneven Rhythm
Mix a very short line with longer ones that breathe. Don't stack three even-length sentences.

- ✅ "Your app can. The attacker sends a sneaky URL. Your app fetches it and hands over the keys."
- ❌ "The attacker sends a URL to your application. Your application fetches that URL. The application returns the response to the attacker."

### 5. Dry, Builder to Builder
- No marketing voice
- No hype
- Barely any exclamation marks
- No "Imagine a world where..."
- No "Unlock the power of..."

### 6. Concrete Beats Abstract
One real artifact reads as "I built this", not slop.

| Abstract | Concrete |
|----------|----------|
| "the configuration file" | "the `.env` file" |
| "the metadata service" | "`http://169.254.169.254/latest/meta-data/`" |
| "the credentials" | "the hidden file with your keys and passwords" |
| "a web framework" | "Django" or "FastAPI" |

### 7. Keep the Author's Grammar
When the human rewrites a line, use it word for word. Fix only genuine typos. Never upgrade their vocabulary.

---

## The Page Opening Pattern

**Always open with "Let's say..."** (not "Say..." or "Imagine..."), then a situation the reader is actually in.

> "Let's say you pull a steak off the pan and cut it right away. The juice runs out over the board."

> "Let's say your coffee keeps coming out thin and sour, and you've already tried grinding finer."

> "Let's say you asked the AI to add link previews. Someone pastes a URL, and your app grabs that page to show a little thumbnail."

Other openers that fit:
- "Let's say you wanted user avatars from a link"
- "Let's say you added a way to import from a URL"
- "Let's say you needed to debug a production issue"

Lead with the feature/situation, not the jargon.

---

## Name the Real Cost (Describing the Pain)

Don't wave at it with vague "it's wrong" or "it's inefficient." Make the pain concrete and felt:

- **Wasted time and tokens**
- **Things you didn't want or that are wrong for your project**
- **Parts that break or won't scale**
- **Money spent on something that doesn't work**

> "Let's say you pull a steak off the pan and cut it right away. The juice runs out over the board, and what's left on your plate is dry."

---

## The Closer

End on a short line that sticks. One sentence, its own beat.

> "Your own app, turned against you."

> "Same steak, nothing lost to the board."

> "The waiting is part of the cooking."

> "Sealed off, so they never clash."

**Rules:**
- One sentence
- Own paragraph (or part of final paragraph with line break)
- Sticks in memory
- Often echoes the title or opening

---

## Length Guidelines

- **Explainer**: 3–5 short paragraphs (roughly 4–6 short sentences total) + closer
- **Action callout**: 1–2 sentences, concrete and immediate
- **Total page read time**: Under 1 minute
- **Don't pad**: If you've said it, stop

---

## Color Roles in Text (Emphasis Spans)

Use these semantic color classes — **color = role, never decoration**:

| Class | Color | Role | Example |
|-------|-------|------|---------|
| `.bad` | Red (`#DC2626`) | The problem, the threat, the mistake, the pain | "The juice runs out over the board, and **what's left on your plate is dry**." |
| `.hl` | Indigo (`#6366F1`) | The mechanism, the fix, the core idea, the block itself | "Heat pushes the juice toward the middle. Give it a few minutes and **it settles back through the whole piece**." |
| `.good` | Teal (`#0D9488`) | The good outcome, the solution, the protection | "**Same steak, nothing lost to the board**." |
| `strong` | Neutral bold | A key phrase that isn't one of the above roles | "The **waiting is part of the cooking**." |

**Usage:**
- ~1 emphasis per role per page (so skimming highlights tells the story)
- Problem (red) → Fix (indigo) → Outcome (teal)
- Don't paint every other word

---

## Action Callout Format

```
[ACTION CALLOUT: LABEL] Concrete, immediate hands-on task.
```

**Standard Labels:**
- `DO THIS TODAY` — Immediate task
- `MEASURE IT` — Data collection
- `BUILD THIS ONCE` — One-time construction
- `DO THE MATH` — Calculation
- `TRY THIS WEEK` — Weekly experiment
- `BUILD THIS WEEKEND` — Weekend project
- `OBSERVE TODAY` — Immediate observation
- `DESIGN THIS WEEK` — Planning task

**Content:** 1–2 sentences, copy-pasteable instruction. Not "consider doing X" — "Do X."

---

## STEAM-IE Section Voice Nuances

| Section | Focus | Example Opener |
|---------|-------|----------------|
| Science | Why it works (physics/chem/bio) | "Let's say your dryer air cools at night to 60% RH. The fruit re-absorbs moisture — the cycle reverses." |
| Technology | Tools, sensors, hardware | "Let's say you bought a digital hygrometer. It reads 30% RH but the real air is 45%." |
| Engineering | Build it, frame it, pipe it | "Let's say you're framing the dryer cabinet. The corners want to rack." |
| Arts | Design, ergonomics, branding | "Let's say you're laying out trays. The mango slices look dull on gray mesh." |
| Mathematics | Numbers, yield, economics | "Let's say your dryer holds 10 kg wet mango. You'll get 2 kg dry." |
| Innovation | Local hacks, substitutions | "Let's say you can't get polycarbonate. Used greenhouse plastic works at half the cost." |
| Entrepreneurship | Business, buyers, cash | "Let's say a hotel buyer wants 50 kg/week. Your dryer does 10 kg/batch." |

---

## Self-Check Before Shipping Copy

- [ ] Zero em dashes?
- [ ] Contractions present?
- [ ] Would a non-technical friend understand every word except the concept name?
- [ ] Is there one concrete example?
- [ ] Short closer line?
- [ ] Opens from a feature/situation they'd actually ask for?
- [ ] Color roles used correctly (red=problem, indigo=fix, teal=outcome)?
- [ ] Action callout is concrete and immediate?
- [ ] Author's original phrasing preserved where they rewrote?

---

## Worked Examples (STEAM-IE Style)

### Science Page (Solar Energy Basics)
> Let's say you build a solar dryer and the fruit isn't drying. The sun's hitting it, the air's hot, but the mango slices stay wet.
>
> Drying isn't about heat. It's about **vapor pressure difference**. The air around the fruit must want water more than the fruit holds it. That gap is the engine.
>
> When the air's relative humidity matches the fruit's water activity, drying stops. This is **equilibrium**. For mango at 50 °C, the equilibrium RH is about 18%. If your dryer air is at 30% RH, the fruit dries. If the air cools at night to 60% RH, the fruit re-absorbs moisture — the cycle reverses.
>
> **The air has to stay thirsty.**
>
> [ACTION CALLOUT: MEASURE IT TODAY] Weigh 10 g of fresh mango slices every 30 minutes in your dryer. Plot the curve. Note when the weight stops dropping — that's equilibrium.

### Technology Page (Low-Power Fans)
> Let's say your solar dryer works great at noon but stalls at 4 PM. The air stops moving, humidity builds, drying halts.
>
> A 12V DC axial fan solves this. It draws 2–5 watts — a small solar panel runs it directly. No battery, no controller, just sun → fan → airflow.
>
> But fan choice matters. Too small and air stalls. Too big and you waste heat. The sweet spot: 80–120 mm, 12V, 0.1–0.3A, ball bearing. Mount it at the exhaust chimney top, pulling air through.
>
> **Moving air is the dryer's heartbeat.**
>
> [ACTION CALLOUT: DO THIS WEEKEND] Wire a 12V 120mm fan to a 10W panel. Mount at chimney top. Measure internal temp and airflow with/without fan at 3 PM.

---

## Quick Reference Card

| Rule | Yes | No |
|------|-----|----|
| Em dashes | | ✅ |
| Contractions | ✅ | |
| Simple words | ✅ | |
| Uneven rhythm | ✅ | |
| Dry tone | ✅ | |
| Concrete examples | ✅ | |
| "Let's say..." opener | ✅ | |
| Named real cost | ✅ | |
| Short closer | ✅ | |
| Color roles used | ✅ | |
| Action callout concrete | ✅ | |