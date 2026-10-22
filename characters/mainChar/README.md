# mainChar

Browser mirror for the one main character.

When you click **Connect mainChar folder** on the test page and choose the `text-rpg`
folder, the module uses this folder and writes:

- `main.json` — the full character (name, gender, age, stamina, image data URL, timestamps)
- `profile.webp` / `.png` / `.jpg` / `.svg` — a viewable copy of the profile picture

The game state is the source of truth. `main.json` is rewritten on each save; it is not
imported automatically. Biome events can lower stamina between saves; the next save
writes the current value.
