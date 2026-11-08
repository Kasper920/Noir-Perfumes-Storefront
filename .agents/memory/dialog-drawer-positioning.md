---
name: Dialog drawer positioning
description: Tailwind translate utilities need a longhand reset when centering dialogs are reused as side drawers.
---

Side drawers that reuse the centered dialog must reset the CSS `translate` longhand, not only `transform`.

**Why:** Tailwind's centering utility retains `translate: -50% -50%`; resetting only `transform` left cart and favorites content outside the viewport. Logical inline-end anchoring then gives right-side LTR and left-side RTL drawers.

**How to apply:** When changing dialog geometry, check computed `translate`, physical and logical insets, and the scroll region in both directions.

Do not impose the viewport's minimum width on `body` when using Radix scroll locking; put that minimum on `html` instead.

**Why:** Radix reserves scrollbar space with a body margin. A 320px body minimum plus its 15px margin creates a 335px document at the 320px breakpoint, particularly visible as an RTL content shift. The modal can fit while the document still overflows.

**How to apply:** For narrow RTL modal checks, measure root scrollWidth/clientWidth and body width/margins together rather than judging the dialog's rectangle alone.
