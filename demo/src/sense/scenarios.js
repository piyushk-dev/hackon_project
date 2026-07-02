/**
 * Ghar Sense — scenario sequences.
 *
 * Each scenario is a real-time choreography (setTimeout chains) so it plays
 * cinematically regardless of the sim clock speed. Scenarios only talk to
 * the engine — the panels react through the event bus.
 */

/** Small helper: run steps as [delayMs, fn] pairs measured from trigger time. */
function sequence(steps) {
  const timers = [];
  for (const [delay, fn] of steps) {
    timers.push(setTimeout(fn, delay));
  }
  return timers;
}

// ─── 🍲 Pressure cooker — count the whistles ─────────────────────────
export function cookerScenario(engine) {
  engine.state.whistles = 0;
  const whistle = (n) => {
    engine.state.whistles = n;
    engine.emitSound('cooker_whistle', `Whistle ${n} of 3`);
    engine.feed('SENSE', '🍲', `Cooker whistle #${n} detected`, 'Acoustic signature match · Kitchen mic array');
  };
  sequence([
    [0,     () => whistle(1)],
    [3500,  () => whistle(2)],
    [7000,  () => whistle(3)],
    [8200,  () => engine.feed('THINK', '🧠', 'Dal recipe = 3 whistles', "Priya's cooker patterns: dal is always 3 whistles, rice is 2")],
    [9000,  () => {
      engine.alexaSays('Priya, teesri seeti ho gayi — gas band kar dijiye. Dal is done! 🍲', 'Echo · Kitchen + Priya\'s phone');
      engine.feed('EXPLAIN', '🔊', 'Announced on kitchen Echo + phone notification', 'Priya is in the balcony — routed to nearest device with presence');
    }],
    [11000, () => engine.ask('priya', 'Next time, should I remind you at the 3rd whistle automatically?', 'kitchen', {
      onAccept: (e) => e.feed('ACT', '📈', 'Whistle-watch enabled for dal', 'Alexa will announce the 3rd whistle without asking'),
    })],
  ]);
}

// ─── 🔔 Doorbell → guest mode ────────────────────────────────────────
export function guestScenario(engine) {
  sequence([
    [0,    () => {
      engine.emitSound('doorbell', 'Unexpected — no delivery scheduled');
      engine.feed('SENSE', '🔔', 'Doorbell at an unusual hour', 'No Amazon delivery or visitor on today\'s calendar');
      engine.visuals?.spawnGuests();
    }],
    [1500, () => engine.feed('THINK', '🧠', 'Occupancy +2 in living room → guests', 'Ultrasound presence: 2 new signatures. Likely guests, not family')],
    [3000, () => {
      engine.setAppliance('ac_living', true);
      engine.setQuietMode(false);
      engine.feed('ACT', '🛋️', 'Guest mode ON', 'Living room AC on · personal announcements muted · chai suggestion sent to kitchen hub');
    }],
    [4500, () => engine.alexaSays('Guests in the living room — I\'ve started the AC and paused personal reminders. Chai suggestion sent to the kitchen. ☕', 'Kitchen hub'),
    ],
    [6000, () => engine.feed('EXPLAIN', '🔒', 'Privacy: reminders held while guests present', 'Dadaji\'s medicine reminders will resume after guests leave'),
    ],
  ]);
}

// ─── 🛕 Temple bell → pooja mode ─────────────────────────────────────
export function poojaScenario(engine) {
  sequence([
    [0,    () => {
      engine.emitSound('temple_bell', 'Morning aarti pattern');
      engine.feed('SENSE', '🛕', 'Pooja bell detected', 'Matches Dadiji\'s 8 AM aarti — recurred 27 of last 30 days');
    }],
    [1800, () => engine.feed('THINK', '🧠', 'Household enters pooja window (~20 min)', 'Historical: no interruptions tolerated during aarti')],
    [3200, () => {
      engine.setQuietMode(true);
      engine.feed('ACT', '🤫', 'Quiet mode ON — nobody asked', 'Notifications held · Echo volumes at 20% · vacuum schedule pushed by 30 min');
    }],
    [5000, () => {
      engine.wellness('pooja', 'done', 'On time, as every morning');
      engine.feed('EXPLAIN', '🛕', 'Will restore volumes when aarti sounds end', 'Quiet mode auto-expires 10 min after last bell');
    }],
  ]);
}

// ─── ⚡ Power cut → inverter triage ──────────────────────────────────
export function powerCutScenario(engine) {
  sequence([
    [0,    () => {
      engine.setPowerCut(true);
      engine.feed('SENSE', '⚡', 'Grid failure — mains dropped to 0V', 'Energy clamp detected instant voltage collapse, not appliance surge');
    }],
    [1500, () => engine.feed('THINK', '🧠', 'Inverter triage: 2.6 hrs backup at current load', 'Priority: Arjun\'s online class > fridge > living room fan. AC and geyser sheddable')],
    [3000, () => {
      engine.setAppliance('ac_living', false, { detected: false });
      engine.setAppliance('geyser', false, { detected: false });
      engine.feed('ACT', '🔋', 'Load shed: AC + geyser off, essentials protected', 'Study room, fridge, and living room fan on inverter');
    }],
    [4500, () => engine.alexaSays("Power cut. Don't worry Dadaji — fan chal raha hai. Arjun, your class won't be interrupted. Backup: 2.6 hours.", 'All Echos'),
    ],
    [6000, () => engine.feed('EXPLAIN', '📉', 'Discom outage pattern suggests ~25 min cut', 'Last 30 days: this slot averages 22–28 minutes'),
    ],
    [15000, () => {
      engine.setPowerCut(false);
      engine.feed('SENSE', '✅', 'Grid restored — 231V stable', 'Waiting 90s before restoring heavy loads (voltage spike protection)');
    }],
    [17500, () => {
      engine.setAppliance('ac_living', true, { detected: false });
      engine.feed('ACT', '❄️', 'AC restored after stabilisation window', 'Geyser left off — next bath is 4 hours away, reheating later saves ₹9');
      engine.addSavings(9, 'Skipped unnecessary geyser reheat after power cut');
    }],
  ]);
}

// ─── 🚱 Motor dry-run rescue ─────────────────────────────────────────
export function motorScenario(engine) {
  sequence([
    [0,    () => {
      engine.setMotor(true);
      engine.feed('SENSE', '💧', 'Water motor started (supply window)', 'Municipal supply detected via inlet pressure sensor');
    }],
    [4000, () => {
      engine.emitSound('motor_whine', 'Pitch shifted +18% — classic dry-run signature');
      engine.feed('SENSE', '🚱', 'Motor whine changed — running dry', 'Acoustic pitch analysis + current draw dropped 30%');
    }],
    [5500, () => engine.feed('THINK', '🧠', 'Supply pressure died mid-fill. Dry running burns the motor', 'A replacement motor costs ₹4,500. Cut power now')],
    [6800, () => {
      engine.setMotor(false);
      engine.feed('ACT', '🛑', 'Motor cut off automatically', 'Will retry when inlet pressure returns');
      engine.addSavings(45, 'Motor protected from dry-run damage (amortised)');
    }],
    [8300, () => engine.alexaSays('Paani ka pressure chala gaya tha — I switched the motor off before it ran dry. I\'ll restart it when supply returns. 💧', 'Echo · Kitchen'),
    ],
  ]);
}

// ─── 💨 AQI spike → protect Dadaji ───────────────────────────────────
export function aqiScenario(engine) {
  sequence([
    [0,    () => {
      engine.state.aqi = 324;
      engine.feed('SENSE', '💨', 'AQI spiked to 324 — Severe', 'PM2.5 sensor, balcony. Stubble-burning season pattern');
    }],
    [1800, () => engine.feed('THINK', '🧠', 'Dadaji\'s evening walk is in 40 minutes', 'His asthma + AQI 300+ = high risk. Indoor alternative needed')],
    [3400, () => {
      engine.setPurifier(true);
      engine.feed('ACT', '🌀', 'Purifier ON · windows-open reminder cancelled', 'Bedroom purifier at turbo before his rest time');
    }],
    [5200, () => {
      engine.alexaSays('Dadaji, aaj bahar mat jaiye — hawa bahut kharab hai. Balcony walk kar lijiye, maine purifier chala diya hai. 🙏', 'Echo · Dadaji\'s room');
      engine.feed('EXPLAIN', '👴', 'Walk rescheduled as balcony stroll', 'Priya notified: "Suggested indoor walk to Dadaji — AQI 324"');
    }],
  ]);
}

// ─── 🤒 Night cough → wellness signal ────────────────────────────────
export function coughScenario(engine) {
  sequence([
    [0,    () => {
      engine.emitSound('cough', '4th episode in 90 minutes');
      engine.feed('SENSE', '🤒', 'Repeated coughing — Dadaji\'s room', 'On-device classification. No audio recorded or uploaded');
    }],
    [2000, () => engine.feed('THINK', '🧠', 'Cough frequency 3× above his normal night baseline', 'Correlated: AQI was high today + he skipped evening chai')],
    [3800, () => {
      engine.setPurifier(true);
      engine.wellness('meds', 'attention', 'Night cough episodes elevated');
      engine.feed('ACT', '🌡️', 'Humidifier + purifier on in his room, gently', 'Volume kept at night-whisper level');
    }],
    [5600, () => engine.feed('EXPLAIN', '📱', 'Morning brief will mention it to Priya', '"Dadaji coughed more than usual last night — maybe check on him." Never a medical claim, just a nudge'),
    ],
  ]);
}

// ─── 🔥 NILM anomaly — iron left on ──────────────────────────────────
export function ironScenario(engine) {
  sequence([
    [0,    () => {
      engine.setAppliance('iron', true);
      engine.feed('SENSE', '🔥', 'Iron signature ON — master bedroom circuit', '1000W resistive step detected by mains clamp');
    }],
    [6000, () => engine.feed('SENSE', '👀', 'Iron still on · room empty for 8 minutes', 'Ultrasound presence: nobody in master bedroom')],
    [7800, () => engine.feed('THINK', '🧠', 'ON + unattended + fabric nearby = fire risk', 'Rajesh irons for ~6 min; 8+ min unattended is anomalous')],
    [9400, () => {
      engine.setAppliance('iron', false);
      engine.feed('ACT', '🔌', 'Smart plug killed the iron', 'Rajesh notified with one-tap "turn back on"');
      engine.addSavings(4, 'Unattended iron switched off');
    }],
    [11000, () => engine.alexaSays('Rajesh, the iron was on with nobody in the room — I\'ve switched it off. Tap to resume if you\'re coming back. 🔥→🔌', "Rajesh's phone"),
    ],
  ]);
}

// ─── 🗣️ Voice moments (speaker ID + code-switching) ─────────────────
export function voiceScenario(engine) {
  sequence([
    [0,    () => engine.voice('dadaji', 'Alexa, thoda pankha tez karo… aur wo bhajan wala laga do', 'hi', 'fan.speed +1 · play(bhajan playlist)')],
    [2500, () => {
      engine.feed('ACT', '🎵', 'Fan speed 3 → 4 · Bhajan playlist on', 'Speaker ID: Dadaji → his saved playlist, his room\'s fan, response in Hindi');
      engine.alexaSays('Ji Dadaji, pankha tez kar diya. Hanuman Chalisa laga rahi hoon. 🎵', 'Echo · Dadaji\'s room');
    }],
    [5000, () => engine.voice('ananya', 'Alexa, unlock the main door!', 'en', 'door.unlock — BLOCKED')],
    [6800, () => {
      engine.feed('EXPLAIN', '🔐', 'Blocked: Ananya (child) cannot unlock doors', 'Voice-ID enforced tier limit. Locks NEVER respond to child voices — any tier');
      engine.alexaSays('Sorry Ananya, I can\'t unlock doors for you. Should I ask Mumma? 🔐', 'Echo · Kids room');
    }],
    [9500, () => engine.voice('priya', 'Alexa, don\'t run the AC after 11 please, bijli ka bill…', 'hi-en', 'constraint: climate.off ≥ 23:00')],
    [11500, () => {
      engine.feed('THINK', '🧠', 'New house rule learned from casual speech', '"AC off after 11 PM" saved as a standing constraint on the climate category');
      engine.feed('ACT', '📜', 'House rule added: AC curfew 11 PM', 'Visible in the family rulebook, Priya can edit or delete it anytime');
    }],
  ]);
}

// ─── ▶ The full day script (compressed) ──────────────────────────────
export function buildDayScript() {
  return [
    { time: 5 * 60 + 50, fn: (e) => e.feed('SENSE', '🌅', 'Home wakes before the family does', 'Ghar Sense day starting — all signals from mock sensors') },

    { time: 6 * 60,      fn: (e) => { e.wellness('wake', 'done', 'Right on time'); e.feed('SENSE', '👴', 'Dadaji is up — bedroom motion at 6:00', 'Matches his 30-day pattern within ±7 min'); } },
    { time: 6 * 60 + 5,  fn: (e) => e.ask('dadaji', 'Warm water for Dadaji\'s bath in 20 minutes?', 'utility', {
        onAccept: (en) => { en.setAppliance('geyser', true); en.feed('ACT', '♨️', 'Geyser on — bath at 6:45', 'Off-peak tariff: heating now costs ₹6 vs ₹9 at 7 AM'); en.addSavings(3, 'Geyser timed to off-peak tariff'); },
      }) },
    { time: 6 * 60 + 15, fn: (e) => { e.setMotor(true); e.feed('SENSE', '💧', 'Municipal supply started — motor on', 'Supply window learned: 6:15–7:30 daily'); } },
    { time: 6 * 60 + 45, fn: (e) => { e.wellness('bath', 'done'); e.setAppliance('geyser', false, { detected: false }); } },
    { time: 6 * 60 + 55, fn: (e) => { e.setMotor(false); e.feed('ACT', '🛑', 'Tank at 96% — motor stopped', 'Overflow prevented. Yesterday\'s overflow: 0 litres'); e.addSavings(6, 'Overflow prevented — ~110 litres'); } },

    { time: 7 * 60 + 10, fn: (e) => cookerScenario(e) },
    { time: 8 * 60,      fn: (e) => poojaScenario(e) },
    { time: 9 * 60,      fn: (e) => { e.wellness('tea', 'done', 'Kitchen activity 8:58'); e.setQuietMode(false); } },

    { time: 9 * 60 + 30, fn: (e) => e.ask('rajesh', 'Everyone has left — arm security and drop to away-mode power?', 'security', {
        onAccept: (en) => {
          en.setAppliance('ac_living', false, { detected: false });
          en.feed('ACT', '🛡️', 'Away mode: armed + AC off + water purifier idle', 'Presence: 2 phones left WiFi, door locked 9:28, only Dadaji-Dadiji home');
          en.addSavings(22, 'AC not cooling an empty living room till 5 PM');
        },
      }) },

    { time: 11 * 60,     fn: (e) => voiceScenario(e) },
    { time: 13 * 60,     fn: (e) => e.wellness('lunch', 'done', 'Kitchen + dining activity at 12:55') },
    { time: 14 * 60,     fn: (e) => aqiScenario(e) },
    { time: 15 * 60 + 30, fn: (e) => powerCutScenario(e) },

    { time: 17 * 60,     fn: (e) => e.ask('priya', 'Family reaches home ~5:40. Pre-cool the living room from 5:20?', 'climate', {
        onAccept: (en) => { en.feed('ACT', '❄️', 'Pre-cool scheduled 5:20 PM', 'Room hits 24°C exactly as the door opens — no blast-cooling at peak tariff'); en.addSavings(11, 'Pre-cool at 24°C beats blast-cool at 18°C'); },
      }) },
    { time: 17 * 60 + 20, fn: (e) => e.setAppliance('ac_living', true) },
    { time: 17 * 60 + 30, fn: (e) => e.wellness('walk', 'skipped', 'Advised indoor walk — AQI still 210') },

    { time: 18 * 60 + 45, fn: (e) => ironScenario(e) },
    { time: 19 * 60 + 30, fn: (e) => guestScenario(e) },

    { time: 21 * 60,     fn: (e) => { e.wellness('meds', 'done', 'Voice confirmation from Dadaji'); e.alexaSays('Dadaji, dawai ka time ho gaya. 💊', 'Echo · Dadaji\'s room'); } },

    { time: 22 * 60,     fn: (e) => {
        const s = e.state;
        e.feed('EXPLAIN', '🌙', `Day summary: ${s.actionsToday} things handled, ₹${s.savingsToday.toFixed(0)} saved`,
          'Dadaji\'s day: normal · 0 overflows · 1 power cut managed · 1 fire risk removed');
        e.alexaSays(`Aaj maine ${s.actionsToday} kaam sambhale, ₹${s.savingsToday.toFixed(0)} bachaye. Dadaji ka din bilkul normal raha. Good night! 🌙`, 'Echo · Master bedroom');
      } },
  ];
}
