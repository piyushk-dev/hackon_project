# Alexa Thinks Ahead — presentation transcript
**Team Bar Raisers · Priyanshu Agarwal & Piyush Kumar · 10 minutes, 9 slides**

Speaking pace assumed: ~135 words/min (calm, not rushed).
Total scripted time ≈ **9:30**, leaving ~30s of slack for clicking, laughs, breathing.

| # | Slide | Speaker | Time |
|---|-------|---------|------|
| 1 | Cover | Piyush | 0:15 |
| 2 | The next ten minutes | Piyush | 0:20 |
| 3 | The problem | Priyanshu | 1:10 |
| 4 | Dadaji's bath — 30 mornings | Priyanshu | 0:55 |
| 5 | What I need as a customer | Priyanshu | 0:45 |
| 6 | Demo video (4:14, voiceless) | both | 4:15 |
| 7 | Tech architecture | Piyush | 1:15 |
| 8 | Impact & future vision | Piyush | 0:45 |
| 9 | Questions | Priyanshu | 0:10 |

Handoffs: Piyush opens → Priyanshu owns the story (slides 3–5) → demo is split at the power cut → Piyush owns the engineering (7–8) → Priyanshu closes.

---

## Slide 1 — Cover (Piyush, 0:15)

> Good morning. We're Team Bar Raisers — I'm Piyush, this is Priyanshu.
>
> Everything you're about to see runs today — a live simulation, a working
> pipeline, and one idea: **Alexa shouldn't wait to be told. It should think ahead.**

*(Click.)*

## Slide 2 — The next ten minutes (Piyush, 0:20)

> Here's our ten minutes. We'll start with what today's Alexa can't do,
> show you one very specific Indian-household scenario, then a full simulated
> day in our demo — that's the longest part, about four minutes — and finish
> with how it's built and where it goes.
>
> The one line to keep in your head: **from a command-taker to a household
> partner.** Priyanshu?

*(Hand over. Click.)*

## Slide 3 — The problem (Priyanshu, 1:10)

> Thank you. Look at this timeline — this is not a "smart home use case,"
> this is just… a normal Indian household day.
>
> Pooja at 5:30. Geyser at 6:15. Pressure cooker at 7:30. The water motor
> at 8. A power cut in the afternoon — not an emergency, a *routine*.
> Tuition at 5. Chai at 6:30.
>
> The point is: **Indian homes run on rhythm.** The same things happen at
> the same times, every single day. And what does the smartest assistant in
> the house do with that rhythm? Nothing. It waits.
>
> Three specific failures. **One — it's reactive, not ready.** You say the
> command at 6:15, the water is hot at 6:35. Too late. **Two — it's
> context-blind.** It doesn't know it's a festival week, doesn't know the
> kids have exams, doesn't know a power cut is a Tuesday thing.
> **Three — trust was never earned.** It's either "do nothing" or "full
> automation you configured yourself." There's no middle where it slowly
> proves itself.
>
> So after the two-hundredth identical command, every user has the same
> thought: *"Alexa, you should already know this."*

*(Click.)*

## Slide 4 — Dadaji's bath (Priyanshu, 0:55)

> Let me make that concrete with one person: Dadaji.
>
> Dadaji bathes at 6:45. Not roughly — 6:45, every weekday. On this slide
> each cell is one morning, and this is exactly what our system sees: the
> geyser turning on, day after day.
>
> For the first week, Alexa does nothing — it just watches. By day 14, the
> pattern is statistically undeniable. Weekdays: 6:45. Sundays: closer to 8.
> It learns both.
>
> **Nobody configured anything. Nobody opened an app and built a routine.**
> She just watched the geyser. That's the whole idea of this project in one
> slide: the routine already exists in the home — the assistant's job is to
> notice it, and then earn the right to act on it.

*(Click.)*

## Slide 5 — What I need as a customer (Priyanshu, 0:45)

> Before building anything, we worked backwards from what a family would
> actually ask for — not features, needs. Four of them.
>
> **"It should already be ready."** Hot water at 6:45 means acting at 6:15.
>
> **"It should understand my home."** My home has pooja, a pressure cooker,
> a water motor, and power cuts — India-first context, not rules hardcoded
> for a Seattle apartment.
>
> **"It should never overreach."** New categories start at
> observe-and-suggest. Autonomy is graduated — and every override takes
> trust away.
>
> And **"it should explain itself."** Every single action ships with a
> plain-language reason. No silent switching.
>
> Now let us show you all four of those, live, in one simulated day.

*(Click — slide 6, start the video.)*

---

## Slide 6 — Demo narration (4:15, split)

The video is voiceless — this narration IS the demo's soundtrack.
**Beats are keyed to what appears on screen, not to fixed seconds.**
Rehearse once against the video and mark your own cue times in the margin.
Priyanshu narrates the morning, hands over to Piyush at the power cut.

### Priyanshu — morning & daytime

**[Opening shot — the house, family asleep]**
> This is the Sharma home — six people, ten devices, one Alexa. Everything
> you'll see is our working demo. Watch the clock, the house, and the panels
> on the right.

**[~06:15 — geyser bubble appears]**
> 6:15 AM. Nobody is awake. Nobody said anything. Alexa pre-heats the
> geyser — because it learned the family wakes at 7, and hot water takes
> 45 minutes. Notice the event log: it doesn't just say *what* it did,
> it says *why*.

**[Family wakes — Dadiji on the balcony, kitchen activity]**
> The house comes alive on its own rhythm — Dadiji's prayers, breakfast,
> school rush. Alexa stays quiet. Knowing when *not* to speak is part
> of the design.

**[~09:00 — security arm, lock bubble]**
> 9 AM — the adults have left. Doors lock, camera arms, and Dadaji gets
> told in plain words: "You're safe inside." Same action, different words
> for different family members.

**[Trust panel moment — gauges visible]**
> And look at the trust scores. Lighting has earned "acts on its own."
> Kitchen is still just observing. Every accepted action nudges a score up;
> every override pulls it down. Autonomy here is earned, never assumed.

### Handoff → Piyush at the power cut

**[Power cut triggers — screen dims]**
> *(Piyush takes over)* 2 PM. Power cut. For most smart homes this is a
> blackout — for an Indian home it's a Tuesday.
>
> Watch the sequence. It senses the grid failure instantly. The reasoning
> panel prioritizes: Wi-Fi and the study room stay up — because tuition
> hours matter — while the AC and geyser shed to protect the inverter.
> And then it *tells the family* what it did and why. No panic, no dark
> house, no one running to check the inverter.

**[~17:30 — AC pre-cool bubble]**
> Evening. 5:30 — Alexa starts cooling the living room, because Rajesh
> reaches home around 6. He walks into a comfortable room he never asked for.

**[~17:45 — warm lights]**
> Sunset — lights warm up for Dadaji's evening. Small thing. It's the small
> things, three hundred and sixty-five days a year.

**[Closing shot — night, house settles]**
> One day. Multiple proactive decisions, each explained, each one adjusting
> trust. Zero commands given. That's the product.

*(Video ends. Click.)*

## Slide 7 — Tech architecture (Piyush, 1:15)

> So how does it work? Two timescales, one decision.
>
> **The slow path** — everything on the left. Device events and sensor
> signals stream into a time-series store. Offline, a feature pipeline feeds
> a sequence model — a DNN over the home's event history — and what it
> outputs is a probability: *the geyser will be needed at 6:45 with 92%
> confidence.* This is the part that learned Dadaji's bath — pure pattern,
> no cloud LLM involved, retrained as the home drifts.
>
> **The fast path** — the reasoning core, on Bedrock. The routine model
> knows the *house*; this knows *today*. Who's home right now, is it a
> festival, what's the weather, is the grid stable. The prediction plus
> today's context go in, and a decision comes out — the same pattern
> Alexa+ uses for its reasoning.
>
> But no decision reaches a device directly. It passes the **trust gate**
> first — per category, the gate decides: act silently, suggest first, or
> stay quiet. And every outcome, accepted or overridden, feeds back into
> both the model and the trust scores. That closed loop *is* the product —
> the intelligence is replaceable; the earned autonomy isn't.

*(Click.)*

## Slide 8 — Impact & future vision (Piyush, 0:45)

> What does this actually buy a family? Our estimate: about **an hour a
> day** — all the small chores of *remembering* — geyser, motor, locks,
> cooling — simply stop existing.
>
> But the bigger unlock is adoption. Almost nobody sets up routines today —
> it's work. Here, **the home sets itself up** just by being lived in. A
> power cut stops being an emergency. And Alexa becomes more than a speaker
> — it becomes the reason you buy the next device.
>
> Where this goes next: **sensor fusion** — richer signals than device
> events alone; **location-aware context** — city-level knowledge, local
> festivals, local grid patterns; and **reflexes** — sub-second responses
> for emergencies like gas or water overflow that never wait on a cloud
> round-trip.

*(Click.)*

## Slide 9 — Close (Priyanshu, 0:10)

> That's Alexa Thinks Ahead — an Alexa that earns trust, one morning chai
> at a time. The demo link and code are on the screen.
>
> We're Team Bar Raisers. Questions?

---

## Rehearsal notes

- **The only hard sync point is the video.** Do one full run against it and
  pencil in real timestamps next to each beat above. If a beat lands early,
  just hold — silence over the video for 5–10 seconds is fine.
- If running long by slide 5, cut: the "different words for different family
  members" line (slide 6) and the "intelligence is replaceable" closer
  (slide 7). Never cut the power-cut narration — it's the peak of the demo.
- The handoff cue into the video is Priyanshu's line "…live, in one
  simulated day" → Piyush clicks and starts playback immediately.
- In PowerPoint, check the video is set to *Play on click* (default) so it
  doesn't autoplay while Priyanshu is still finishing slide 5.
