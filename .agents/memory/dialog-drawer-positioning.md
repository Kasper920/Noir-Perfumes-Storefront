---
name: Dialog drawer positioning
description: Tailwind translate utilities need a longhand reset when centering dialogs are reused as side drawers.
---

Side drawers that reuse the centered dialog must reset the CSS `translate` longhand, not only `transform`.

**Why:** Tailwind's centering utility retains `translate: -50% -50%`; resetting only `transform` left cart and favorites content outside the viewport. Logical inline-end anchoring then gives right-side LTR and left-side RTL drawers.

**How to apply:** When changing dialog geometry, check computed `translate`, physical and logical insets, and the scroll region in both directions.
