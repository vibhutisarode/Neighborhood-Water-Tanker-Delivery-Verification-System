# JalVerify design trade-offs

## Trust assumption

JalVerify does not claim that a photograph alone makes a delivery impossible to fake. Instead, it creates a stronger chain of evidence:

**Server timestamp + tanker identity + target block + meter photograph + manager verification + immutable audit event.**

This changes the dispute from “the driver says he delivered it” to “here is the recorded delivery evidence and the manager's verification decision.”

## Why these choices

- **Photo evidence:** It is inexpensive, familiar to drivers, and gives managers something concrete to inspect.
- **Server timestamps:** A driver cannot edit the authoritative submission time from the form.
- **Human verification:** A manager can interpret glare, partial loads, wrong blocks, and context better than a brittle automated rule.
- **No GPS:** Location accuracy and privacy trade-offs are not necessary for the core evidence loop.
- **No hardware sensor:** The MVP must work with existing tankers and apartment infrastructure.
- **No blockchain:** Postgres audit events provide an auditable history without operational overhead.
- **No AI fraud detection:** Deterministic signals explain why a delivery needs attention without accusing a driver.
- **Public transparency:** Residents see verified volume and under-review volume separately, which builds trust without exposing private manager notes.

## Deliberate limits

- A photo can potentially be manipulated.
- Manually entered volume can be incorrect.
- A driver name is not equivalent to physical identity verification.
- GPS, hardware meters, IoT sensors, paid OCR and payment processing are intentionally excluded from the 24-hour MVP.
- Human manager verification remains necessary.

The deployed workflow calculates duplicate, off-hours, mismatch, and verification-priority signals on the server. These signals help managers prioritize review; they do not prove fraud.

The product is evidence-driven decision support, not AI-powered fraud detection.
