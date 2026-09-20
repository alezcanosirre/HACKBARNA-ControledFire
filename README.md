# ControlledFire

**Real wildfire data, read the way an incident commander actually needs it.**

Spain just had its worst wildfire year on record. The data to fight that exists — satellites, weather stations, years of ignition history — but it's scattered across APIs, feeds, and formats nobody reads standing on a hillside with a radio in one hand. ControledFire turns that data into three questions a first responder actually asks, answered live: **what's burning right now, where might the next one start, and what should I do about it.**

Built at [HackBarna AI Summit 26](https://hackbarna.com) for Norrsken House Barcelona's *AI for Wildfire* challenge, on real data from [Deepfire](https://deepfire.co).

---

## What it does

ControledFire is a live operations map of the Barcelona metropolitan region with three modes:

### 🔥 ACTUAL — what's burning right now
Polls Deepfire's satellite feed (VIIRS, MTG) every two minutes: active clusters, satellite-derived fire perimeters, and individual hotspot detections. Every burning cell on the map is a real detection, rasterized onto the same grid the rest of the app speaks. Click a fire and get its real detection time, source satellite, confidence, radiative power, and — once Deepfire's physics simulation finishes computing it — the wind driving its spread.

### 📈 PRED — where the next one might start
A transparent, weighted heuristic over two measured inputs: historical ignition density and current weather (dryness, heat, wind). No black box — every risk score comes with the exact drivers and their weights, plus a model-written summary of *why* the area looks the way it does today. Below a threshold, nothing is painted: a quiet day should look quiet.

### 🤖 AI-recommended actions
Click any active fire and get a ranked, prioritized list of response actions — generated on demand by an LLM (via [Nebius Token Factory](https://nebius.com)) grounded strictly in that fire's real data: detection confidence, radiative power, burned area, wind. The model is instructed never to invent a place name, a population figure, or a coordinate it wasn't given.

### 🎮 SIMULATION — the full picture, clearly labeled as invented
Deepfire doesn't (yet) expose weather, land cover, or population-at-risk for a real detection — so SIMULATION shows three hand-built incident cases with the complete picture: terrain, spread direction, values at risk, downwind population. It exists to demo what the product looks like once those data sources exist, and it is never on screen at the same time as real data, so nobody mistakes an exercise for an emergency.

---

## The principle the whole codebase is built on

**If Deepfire doesn't give us a number, we don't show one.**

No fake temperature, no invented population count, no fabricated place name standing in for a raw coordinate. Where real data is missing, the interface says so explicitly instead of quietly filling the gap — a blank forecast is a problem you can see and fix; an invented one is a problem you find out about live, in front of a fire crew, at the worst possible time. Every field in the UI can be traced back to either a real Deepfire endpoint, a measured weather sample, or a mock explicitly labeled as one.

---

## Architecture

```
map/   React + TypeScript + deck.gl + MapLibre — the operations map
api/   Node.js — the Deepfire proxy, ignition-risk heuristic, and Nebius integration

┌──────────────┐  poll every 2 min   ┌──────────────────┐
│   Deepfire   │ ───────────────────▶│  api/src/live/    │
│  (clusters,  │                     │  builds fires[],   │
│  perimeters, │                     │  risk cells, and   │
│  hotspots,   │                     │  ignition-risk      │
│  fire-spread)│                     │  from real data     │
└──────────────┘                     └─────────┬─────────┘
                                                │ /api/live-fires
┌──────────────┐  on demand, per click ┌────────▼─────────┐
│    Nebius    │◀──────────────────────│  map/ (deck.gl)   │
│ Token Factory│  ranked actions       │  ACTUAL · PRED ·   │
└──────────────┘                       │  SIMULATION        │
                                       └───────────────────┘
```

- **H3 → grid rasterization**: Deepfire speaks H3 hexagons; the map is drawn on a Web Mercator quadkey lattice. The conversion happens once, at the edge, so the rest of the app only ever sees one grid.
- **Client-agnostic backend**: the live-data proxy (`api/src/live/server.ts`) is a small standalone Node server — auth, caching, and rate-limiting for Deepfire and Nebius live entirely there, never in the browser.
- **Fire Engine**: a deterministic, pure-function simulation core (`api/src/engine`) — fire propagation, resource deployment, firebreaks, risk aggregation — fully unit-tested, independent of any UI.

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, deck.gl, MapLibre GL, Tailwind |
| Geospatial | H3 (Uber's hexagonal grid), custom Web Mercator quadkey math |
| Backend | Node.js, TypeScript, vitest |
| Real wildfire data | [Deepfire](https://deepfire.co) OGC Features API (clusters, satellite perimeters, hotspots, fire-spread simulation) |
| AI | [Nebius Token Factory](https://nebius.com) (Llama 3.3 70B) for grounded, on-demand action recommendations |

---

## Getting started

```bash
# 1. Install both packages
cd api && npm install
cd ../map && npm install

# 2. Configure credentials
cd ../api
cp .env.example .env
# fill in DEEPFIRE_CLIENT_ID / DEEPFIRE_CLIENT_SECRET and NEBIUS_API_KEY

# 3. Run the live-data proxy (talks to Deepfire + Nebius)
npm run live

# 4. In a second terminal, run the map
cd ../map
npm run dev
```

Open `http://localhost:5173` — the map starts on ACTUAL, showing whatever Deepfire's feed reports live for the Barcelona metropolitan area right now.

Run the Fire Engine's test suite with `npm test` inside `api/`.

---

## Why this matters for the challenge

Real-time wildfire data exists in abundance; the hard part is turning it into something an operator can act on inside the ten seconds they have to look at a screen. That's what this project is: not a bigger model, not a prettier chart — a disciplined pipeline from real satellite detections to a ranked, explainable, honestly-labeled recommendation, built to survive contact with an actual emergency.
