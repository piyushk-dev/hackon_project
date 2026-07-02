# Ghar Sense — Sensing Layer Architecture

How the new sensor + voice ideas (demoed with mock data on the demo landing page, `demo/index.html`)
plug into the existing **Alexa Thinks Ahead** backend. Nothing on this page
requires new architecture — every signal rides the pipeline that already
exists: **EventBridge → EventProcessor → ContextEngine → ProactiveEngine →
Autonomy/Learning → Explain**.

## The one-line pitch

> The Echo already has the sensors (mic, ultrasound presence, temperature,
> Zigbee hub). One ₹1,500 mains clamp + three cheap sensors give Alexa eyes
> on every appliance, the water tank, the gas cylinder, and the air —
> without a single camera.

---

## 1. Signal sources → where they enter the backend

| Ghar Sense signal | Real sensor | Entry point | Existing code it feeds |
|---|---|---|---|
| Sound events (whistle, doorbell, pooja bell, motor whine, cough) | Echo mic, **on-device classification** (Alexa-Guard-style; raw audio never uploaded) | EventBridge event `source: smart-home.sensor`, `detail-type: AcousticEvent` | `EventProcessorFunction` → `ProactiveEngine.handle_event()` |
| Appliance on/off + wattage (NILM) | Single CT clamp on the mains | Same bus, `detail-type: ApplianceSignature` | `DeviceState` table + `ContextEngine._ingest` (step 1 of `build_snapshot`) |
| Voltage / power cut | Same clamp (instant 0V collapse ≠ appliance surge) | `detail-type: GridEvent` | Existing power-cut path (`/scenario/power-cut` logic becomes event-driven) |
| Water tank level / supply window | Ultrasonic tank sensor | `detail-type: SensorReading` | `SensorFusion.fuse()` — temporal weighting (`max(0.1, 1 - age/max_staleness)`) applies unchanged |
| LPG remaining | Load-cell pad under cylinder | `detail-type: SensorReading` | Resource levels step of `build_snapshot` (`resource_levels` already exists in `ContextSnapshot`) |
| AQI (PM2.5) | Balcony sensor | `detail-type: SensorReading` | Environmental step of `build_snapshot` (`environmental` dict already exists) |
| Presence per room | Phone-on-WiFi + Echo ultrasound | `detail-type: PresenceEvent` | `active_activities` in `ContextSnapshot`; also feeds `FamilyRoutineModeler` |

**Key point for judges:** the `ContextSnapshot` model already has slots for
all of this (`device_states`, `active_activities`, `resource_levels`,
`environmental`, `detected_patterns`). The sensing layer *fills* the model;
it doesn't change it.

## 2. Acoustic intelligence

- Classification runs **on the Echo** (like Alexa Guard's glass-break/smoke
  detection today). Only the *label* + confidence leaves the device:
  `{type: "cooker_whistle", confidence: 0.97, room: "kitchen"}`.
- Routed as an event → `ProactiveEngine.handle_event()` → Bedrock reasoning
  with the event in context → predictions routed by the existing confidence
  thresholds (≥0.85 auto, ≥0.60 recommend, ≥0.40 inform).
- Recurring sounds (pooja bell at 8 AM, cooker at 7 AM) become **patterns**
  via `FamilyRoutineModeler` — sound events are just a new activity marker.
- Privacy is a product feature, not a disclaimer: wake-word for speech,
  label-only for sounds, nothing stored.

## 3. Energy X-Ray (NILM)

- One clamp reports the aggregate load curve; signature detection (step
  changes matched to known appliance wattages) can run on-device or in the
  `EventProcessorFunction`.
- Each detected transition writes to the **DeviceState** table exactly as if
  the appliance had a smart plug — downstream code cannot tell the
  difference. That's the trick: NILM retrofits the whole existing device
  registry onto homes with dumb appliances.
- Anomalies (iron on + room empty 8 min) are events → reasoning → the
  `safety` priority in `ConflictResolver` already outranks everything.
- ₹ savings = kWh avoided × ToD tariff table; surfaces in the API as part of
  the context snapshot (`resource_levels.savings_today`).

## 4. Voice as the feedback channel

- **Speaker ID** (Alexa voice profiles) resolves the utterance to a family
  member → that's the `member#category` key `TrustScoreManager` already
  uses. Voice becomes the enforcement mechanism for tiers: Ananya's voice
  physically cannot unlock doors because her tier is checked *per voice*,
  and `SAFETY_DEVICES` never auto-execute regardless.
- "Haan, karo" / "Nahi, rehne do" → `AutonomyEngine.record_acceptance()` /
  `record_override()` (+5 / −15, decay −0.5/day) — the demo's trust ladder
  runs the identical math.
- Casual constraints ("AC mat chalao 11 ke baad") → Bedrock parses
  code-switched speech into a structured preference → `LearningEngine`
  Bayesian update + a visible "house rule". (Bedrock integration point —
  deferred until live-demo prep.)

## 5. Elder wellness ("Dadaji's Day")

- Zero new hardware: checkpoints are inferred from events the system already
  sees (bedroom motion, geyser, kitchen hub, sound events, door sensor).
- `FamilyRoutineModeler` already models per-member routines with day-parsing
  and confidence; wellness = "today's events vs. his 30-day pattern".
- Deviations emit INFORM-level predictions (never alarms, never medical
  claims) → routed to Priya via the existing `ExplanationGenerator`
  role-tailoring (elder/parent/child messages already exist in
  `explainer.py`).

## 6. New API surface (additive)

```
GET  /sense/events?since=...      → recent classified sensor events
GET  /sense/energy                → load curve + detected appliances + ₹ today
GET  /wellness/{member}/summary   → checkpoint states + normality signal
POST /rules                       → natural-language house rule → parsed constraint
```

All sit behind the existing API Gateway + Cognito authorizer; DynamoDB
`ContextSnapshot` table already stores the snapshots these read from.

## 7. Demo (mock) → production path

| Demo element (landing page) | Mock today | Real tomorrow |
|---|---|---|
| Waveform + detections | Scripted `SOUND_LIBRARY` events | Echo on-device classifier → EventBridge |
| Power trace + chips | `currentLoadWatts()` from scripted appliance state | CT clamp stream + NILM |
| Tank / LPG / AQI | Drift simulation in `SenseEngine` | 3 sensors, `SensorReading` events |
| Ask cards + trust ladder | Local +5/−15 math | `AutonomyEngine` via `/autonomy/tiers` (same numbers) |
| Live Cognition feed | Scripted SENSE/THINK/ACT/EXPLAIN entries | `ActionPlan.reasoning_chain` from Bedrock + event log |
| Alexa announcements | Toast component | Echo announcements via `preferred_echo` routing |

Run it: `cd demo && npm run dev` → http://localhost:5173
(“Play the Day” compresses 6 AM–10 PM into ~4 minutes at 2× speed.)
