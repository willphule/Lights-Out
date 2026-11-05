# Lights Out

A 2D stealth platformer where each level is a small sandbox with many solutions.

- **Shadows hide you and light exposes you.** Shoot out lamps, crawl through vents, hide in lockers and throw bottles to pull guards away.
- **Every mission has a target and several ways to reach them:** borrowed uniforms, setups that look like accidents (falling crates, electrified puddles), or slipping through unseen.
- **Possess a guard or a rat for a few seconds.** Walk a guard through a security door or have them knock out their own boss. Squeeze a rat between gate bars and through grates. Free the caged workers on the way.
- **You're ranked at the end of each level** (S to D), with badges and a list of approaches you've found, so replays pay off.

## Look and sound

Each mission has its own palette, wall textures, props and weather: a foundry glowing through sooty windows, a tiled pump station dripping in cold light, a gala in wine-red wallpaper under arched moonlit windows, a prison yard in the rain under a city skyline, and a power station whose city lights go dark when you trip the master breaker. Lamps are shaded cones with soft pools, visible beams and drifting dust, and the light you see is the light guards use.

The music is a noir score synthesized live in the browser. It stays calm while you're unseen, adds brushes and a heartbeat as guards grow suspicious, breaks into drums when you're spotted, and muffles while you hide. Each mission also has its own ambience. There are no audio or image files.

## Play

There's no build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

URL options: `?level=2` jumps straight into a mission, and `?unlock` unlocks every mission on the select screen.

## Controls

| Key | Action |
| --- | --- |
| A / D | Move |
| Space (or W) | Jump |
| S | Crouch: quieter, harder to see, fits in vents |
| S + Space | Drop through a platform |
| W / S on a ladder | Climb |
| Shift | Run (loud) |
| Mouse + left click | Shoot a pellet: break lights, cut ropes, hit fuse boxes |
| Right click / F | Throw a bottle as a distraction |
| E | Interact: takedown from behind, take uniform, free worker, levers, lockers, exit |
| Q | Possess the guard or rat nearest the mouse. Press Q again to return |
| Esc / P | Pause |
| R | Restart mission |
| H | Controls overlay |
| M | Mute |

### Controller

Plug in any standard controller (Xbox, PlayStation, Switch Pro) and press a button. Prompts switch to controller buttons, and switch back as soon as you touch the keyboard or mouse.

| Button | Action |
| --- | --- |
| Left stick / D-pad | Move, climb ladders. Push down to crouch |
| A | Jump (down + A drops through a platform) |
| X | Interact. Hold to free a worker |
| Y | Possess the guard or rat you're aiming at. Y again to return |
| Right stick | Aim. The reticle snaps onto nearby lamps, ropes, fuse boxes and people |
| RT / LT | Shoot / throw a bottle |
| LB or click the left stick | Run |
| Start | Pause (restart is in the pause menu) |
| Back | Controls screen |
| A / B in menus | Select / go back |

Controllers that support it vibrate on takedowns, crashes, power surges and getting shot.

## How stealth works

- The **visibility meter** shows how much light is on you. Crouching makes you harder to spot. Inside vents and lockers you can't be seen at all.
- Guards see in a **cone** in front of them, drawn on screen. It turns orange when they're suspicious and red when they've spotted you. A spotted player has about a second to break line of sight before the guard fires.
- **Noise** appears as rings. Walking is audible up close, running carries far, and crouch-walking is silent. Broken lamps, bottles and pellet ricochets all draw guards to investigate.
- **Bodies** left in the light get found, which costs you points and puts guards on edge.
- In **disguise**, guards ignore you unless you do something suspicious in front of them (run, shoot, throw, climb out of a vent, take someone down) or hang around close to them in the light.
- **Searchlights** sweep back and forth and light up whatever they cross, just like a lamp. Shoot them out or cut their power.
- **Laser tripwires** sit at chest height. Touching one sounds an alarm and draws every guard nearby. Crouch under them. A uniform's staff badge doesn't trip them, and they shut off while a fuse box is tripped.
- **Possession** drains your WILL bar. Your own body stays behind in a trance, so leave it somewhere dark.

## Missions

1. **Night Shift**: Foreman Grell's foundry. Teaches the basics and has four approaches.
2. **Low Water**: Overseer Vask's pumping station. Puddles, a fuse box, a gated hall and rats.
3. **The Gala**: Baroness Vell's ballroom. Flashlight guards, a chandelier and a staff-only door.
4. **Debtors' Yard**: Warden Okka's prison yard. Sweeping searchlights, rain puddles, a gantry crane and five cells to open.
5. **Lights Out**: Chairman Morrow's power station, the finale. Laser tripwires (crouch under them, wear a uniform, or kill the power), a master breaker that blacks out the station, and a bodyguard who never leaves Morrow's side.

## Scoring

You get 1,000 points for completing a mission, plus a bonus for how the target went down (accident > puppeteer > disguise > takedown). Freed workers, never being detected and finishing under par add points. Alarms, bodies found, knockouts and other casualties take points away. Best ranks and discovered approaches are saved in the browser.

## Code layout

| File | Contents |
| --- | --- |
| `js/core.js` | Math helpers, keyboard/mouse input, synthesized sound effects |
| `js/level.js` | Tile map, collision, line of sight, light visibility polygons |
| `js/actors.js` | Player, guards, target, rats, and shared movement and AI |
| `js/game.js` | A running mission: perception, noise, interactions, possession, hazards, rendering, scoring |
| `js/scenery.js` | Mission themes: wall textures, props, windows, sky and skyline, weather, dust, vignette |
| `js/music.js` | Adaptive music, ambience and stingers (Web Audio) |
| `js/render.js` | Character drawing and the HUD |
| `js/levels.js` | Mission data, with the map legend at the top |
| `js/main.js` | Menus, briefing, results, save data, main loop |

Levels are ASCII maps. The legend is at the top of `js/levels.js`, so you can add a mission by appending another entry to `LO.LEVELS`.
