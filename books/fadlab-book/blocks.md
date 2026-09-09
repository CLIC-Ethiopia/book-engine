# Blocks

The backlog. One entry per page you intend to write, in any order. The `/block` skill
reads this to know what a page is about before it drafts anything, so the more honest
these lines are, the less you have to fix later.

Nothing here is printed. The page gets written from it.

Keep the four lines. They map onto the page:

- **What** becomes the explainer.
- **Use when** decides whether the page is even worth writing.
- **Action** becomes the box at the bottom of the page.
- **Band** tells the skill whether to draw a diagram or generate a photo.

---

## Part 1 · Your first part

#### SSRF
Security · diagram
- **What:** an attacker gives your app a link that points back at your own machine, so
  your app fetches something private and hands it over.
- **Use when:** your app fetches any URL a user gave it. **Skip when:** it never does.
- **Action:** "I fetch user-supplied URLs. Add an SSRF guard that blocks private IPs and
  unsafe schemes, re-checked when the address resolves."
- **Band:** diagram (attack: there and back across a trust boundary, red leak arrow)

---

## Vertical Hydroponics Farm
Sustainability · diagram
- **What:** plants grow in stacked towers with nutrient-rich water recirculating instead of soil, using up to 95% less water than traditional farming.
- **Use when:** growing food in limited spaces with reduced resource consumption and no arable land.
- **Action:** "I design a closed-loop vertical hydroponic system with nutrient monitoring, pH balancing, and LED lighting optimized for each tower level."
- **Band:** diagram (performance: before and after, or a timeline from seed to harvest across tower levels)

---

<!-- Copy the shape above for your own pages.

#### <Title>
<Category> · <diagram|photo>
- **What:**
- **Use when:**  ... **Skip when:**
- **Action:**
- **Band:**
-->
