# Googly Survival

Four googlies, four wild maps: survive the **Frozen Tundra**, the **Scorched Dunes**, the **Whispering Woods** or the **Rocky Peaks**, and find out who ends up with the most money and the best shelter.

- **Survive**: keep health, food, water and body temperature up. Nights are cold, desert days are roasting, and every day brings a storm (blizzard, sandstorm, thunderstorm with lightning, or rockslide with falling boulders).
- **Gather**: chop trees, mine rock/ice/sandstone and gold, pick berries and cactus fruit, fish through the ice, drink at lakes.
- **Money**: sell at the trading post, where prices change every day. Buy an axe, a pickaxe, a coat, a sun hat, a bigger backpack or a canteen. Grab parachuted supply crates. Bonk other googlies so they drop things.
- **Shelter**: 5 levels on your plot, different in every biome (snow wall → igloo → ice palace, adobe → desert palace, lean-to → wooden fort, rock shelter → stone castle). Inside you're warm, heal fast and are safe from storms.
- **Winner**: money + shelter value − 40 per faint. Awards for Richest, Best Shelter and Toughest. Stars from each game buy skins and pets.
- **Solo**: ▶ PLAY SOLO runs the whole game in the page against 3 computer googlies (Easy / Normal / Hard). No server needed. Auto-saves every 30 s; CONTINUE picks it up.
- **Sound**: everything is synthesised live: a full song per map (A-A-B-A, real-ish instruments: plucked guitar/oud, flute, horn, strings, piano, kalimba, bells, taiko), night/storm/camp/victory tunes that crossfade, per-biome ambience (birds, crickets, owls, wind, rain, sand, ice creaks, wolves, campfire crackle, lapping water; muffled inside your shelter), surface-aware footsteps, googly voices and body sounds. Music / effects / nature volume sliders in the pause menu.
- **Online** (optional): public/private lobbies with 4-letter codes and invite links, walk around Base Camp while you wait, chat, up to 4 players, and CPUs fill empty spots (and take over anyone who leaves).

## Layout

- `web/public/js/core.js` — the whole game (Room): used by the server for online lobbies and by the page for solo.
- `web/public/js/maps.js` (seeded terrain, lakes, nodes, plots), `sim.js` (movement over terrain, nav grid + A*), `world.js` (three.js drawing), `main.js` (client), `sfx.js` (synthesised sound + music), `googly.js`, `pets.js`, `icon.js`.
- `web/server.js` — Node + ws: static files, lobbies, chat relay.
- `mac/` — `Googly Survival.app`: `mac/build.sh` packs the game inside the app (served over a `gsv://` scheme), so solo works offline. Online uses `https://googly-survival.onrender.com` (change it with the app's menu or `GSV_URL`).
- `render.yaml` — Render Blueprint (service `googly-survival`, root `web/`).

## Run locally

    cd web && npm install && npm start      # http://localhost:8000

## Tests

    node web/test/maps.mjs                     # every map: nodes, plots and lakes reachable
    node web/test/sim.mjs MAP DIFF DAYS        # a whole game of 4 CPUs, as fast as possible
    URL=ws://localhost:8000 node web/test/lobby.mjs   # two online players: lobby, chat, start, gather, leave
    PORT=8000 web/test/shot.sh out.png "solo=2&clock=100"   # headless screenshot (also shelters=2, storm=1, trade=1, rich=1, fakeend=1, lobby=1, icon=1, cam=x,y,z,tx,ty,tz)
    node web/test/cdp.mjs "audiotest=1" "..."            # real-time Chrome driver; ?audiotest=1 renders every sound offline and measures it
    "Googly Survival.app/Contents/MacOS/GooglySurvival" --windowed --query "solo=0" --shot out.png --delay 8
