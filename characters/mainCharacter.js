/* Main character module v0.2 — one player character with a profile picture and stamina.
   The UI calls save()/prepareImage()/connectFolder() directly; other modules read the
   state slice or listen for mainCharacter:saved / mainCharacter:statChanged.
   Location events are applied here through the event bus. See ENGINE_SPEC.md. */
(function (global) {
  "use strict";
  const D = global.MainCharacterData;

  if (!D || !Array.isArray(D.genders) || !D.genders.length)
    throw new Error("characters/mainCharacterData.js must define MainCharacterData.genders");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const STAMINA_MAX = Math.max(1, Math.round(Number(D.staminaMax) || 100));
  const STAMINA_START = clamp(
    Number.isFinite(Number(D.staminaStart)) ? Math.round(Number(D.staminaStart)) : STAMINA_MAX,
    0, STAMINA_MAX
  );

  const escapeXml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[ch]));

  function defaultAvatar(name) {
    const text = String(name || "").trim();
    const initials = text.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
    let hash = 0;
    for (const ch of text || "?") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="hsl(${hue}, 42%, 34%)"/>` +
      `<stop offset="1" stop-color="hsl(${(hue + 42) % 360}, 42%, 18%)"/>` +
      `</linearGradient></defs>` +
      `<rect width="256" height="256" fill="url(#g)"/>` +
      `<circle cx="128" cy="128" r="96" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>` +
      `<text x="128" y="156" font-family="Georgia, serif" font-size="92" fill="#f6f5f2" text-anchor="middle">${escapeXml(initials)}</text>` +
      `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;

    const meta = dataUrl.slice(0, comma);
    const data = dataUrl.slice(comma + 1);
    const mimeMatch = /^data:([^;]+)/.exec(meta);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const isBase64 = /;base64/i.test(meta);

    let bytes;
    if (isBase64) {
      const binary = global.atob(data);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(data));
    }

    const extensions = {
      "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png",
      "image/svg+xml": "svg", "image/gif": "gif"
    };
    return { blob: new global.Blob([bytes], { type: mime }), ext: extensions[mime] || "bin" };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new global.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = src;
    });
  }

  function createMainCharacterModule() {
    let engine = null, disk = null, bound = false;

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.mainCharacter;

    const normalizeCharacter = () => {
      const character = S().character;
      if (!character) return null;

      const max = Math.max(1, Math.round(Number(character.staminaMax) || STAMINA_MAX));
      const value = Number.isFinite(Number(character.stamina))
        ? Math.round(Number(character.stamina))
        : STAMINA_START;
      character.staminaMax = max;
      character.stamina = clamp(value, 0, max);
      return character;
    };

    const writeFile = async (dir, name, data) => {
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    };

    const writeBlob = async (dir, name, blob) => {
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    };

    const validate = (data) => {
      const name = String((data && data.name) || "").trim().replace(/\s+/g, " ");
      if (!name) throw new Error("Enter a name.");
      if (name.length > D.nameMaxLength)
        throw new Error(`Name must be ${D.nameMaxLength} characters or fewer.`);

      const gender = String((data && data.gender) || "").trim();
      if (!D.genders.includes(gender)) throw new Error("Choose a gender.");

      const age = Math.round(Number(data && data.age));
      const [min, max] = D.ageRange;
      if (!Number.isFinite(age) || age < min || age > max)
        throw new Error(`Age must be a whole number from ${min} to ${max}.`);

      const image = data && typeof data.image === "string" && data.image.startsWith("data:image/")
        ? data.image : null;
      return { name, gender, age, image };
    };

    const mod = {
      name: "mainCharacter", depends: [],

      init(eng) {
        engine = eng;
        engine.slice("mainCharacter", { character: null });
        normalizeCharacter();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:location:event", (e) => mod.applyEventEffects(e.depth + 1, e.data || {}));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("mainCharacter", { character: null });
        normalizeCharacter();
      },

      get folderConnected() { return !!disk; },

      defaultAvatar,

      // Browser-only: centre-crop, resize and compress an uploaded image.
      async prepareImage(file) {
        if (!file || !/^image\//.test(file.type)) throw new Error("Choose an image file.");
        if (file.size > D.maxUploadBytes)
          throw new Error(`Image is too large (max ${Math.round(D.maxUploadBytes / 1024 / 1024)} MB).`);

        const source = await readFileAsDataUrl(file);
        const image = await loadImage(source);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) throw new Error("Could not read that image.");

        const side = Math.min(width, height);
        const size = Math.max(1, Math.min(D.imageSize, side));
        const canvas = global.document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);

        let result = canvas.toDataURL("image/webp", D.imageQuality);
        if (!result.startsWith("data:image/webp")) result = canvas.toDataURL("image/png");
        return result;
      },

      // Validate and store the one main character. The image stays out of the event log.
      save(data, depth = 0) {
        const clean = validate(data);
        const s = S(), now = engine.now, existing = s.character;
        const previousCustom = existing && existing.imageSource === "upload" ? existing.image : null;
        const image = clean.image || previousCustom || defaultAvatar(clean.name);
        const imageSource = (clean.image || previousCustom) ? "upload" : "default";
        const staminaMax = existing
          ? Math.max(1, Math.round(Number(existing.staminaMax) || STAMINA_MAX))
          : STAMINA_MAX;
        const stamina = existing && Number.isFinite(Number(existing.stamina))
          ? clamp(Math.round(Number(existing.stamina)), 0, staminaMax)
          : clamp(STAMINA_START, 0, staminaMax);

        const character = {
          id: "main",
          name: clean.name,
          gender: clean.gender,
          age: clean.age,
          image,
          imageSource,
          stamina,
          staminaMax,
          createdAtTick: existing ? existing.createdAtTick : now.tick,
          createdAt: existing ? existing.createdAt : now.text,
          updatedAtTick: now.tick,
          updatedAt: now.text
        };

        s.character = character;
        engine.fire({
          type: "mainCharacter:saved",
          text: existing
            ? `${character.name}'s profile was updated.`
            : `${character.name} is now the main character.`,
          data: { id: character.id, name: character.name, gender: character.gender, age: character.age }
        }, depth);
        return character;
      },

      // First effect pipeline: location events can spend or restore stamina.
      applyEventEffects(depth = 0, data = {}) {
        const character = S().character;
        if (!character) return [];

        const max = Math.max(1, Math.round(Number(character.staminaMax) || STAMINA_MAX));
        character.staminaMax = max;
        character.stamina = clamp(
          Number.isFinite(Number(character.stamina)) ? Math.round(Number(character.stamina)) : STAMINA_START,
          0, max
        );

        const effects = Array.isArray(data.effects) ? data.effects : [];
        const applied = [];
        for (const effect of effects) {
          if (!effect || effect.stat !== "stamina") continue;
          const delta = Math.round(Number(effect.delta));
          if (!Number.isFinite(delta) || delta === 0) continue;

          const next = clamp(character.stamina + delta, 0, max);
          const actual = next - character.stamina;
          if (!actual) continue;

          character.stamina = next;
          applied.push({ stat: "stamina", delta: actual, value: next, max });
          const verb = actual < 0 ? "loses" : "gains";
          engine.fire({
            type: "mainCharacter:statChanged",
            text: `${character.name} ${verb} ${Math.abs(actual)} stamina (${next}/${max}).`,
            data: {
              id: character.id, stat: "stamina", delta: actual,
              value: next, max, eventId: data.eventId || null
            }
          }, depth);
        }
        return applied;
      },

      toJSON() {
        const character = S().character;
        return character ? JSON.stringify(character, null, 2) : null;
      },

      async writeImage(character) {
        if (!disk || !character.image) return null;
        const parsed = dataUrlToBlob(character.image);
        if (!parsed) return null;

        for (const ext of ["webp", "jpg", "jpeg", "png", "svg", "gif"]) {
          try { await disk.removeEntry(`${D.imageBase}.${ext}`); } catch (e) { /* absent */ }
        }

        const name = `${D.imageBase}.${parsed.ext}`;
        await writeBlob(disk, name, parsed.blob);
        return name;
      },

      // Write characters/mainChar/main.json plus a viewable profile.<ext>.
      async writeToFolder() {
        if (!disk) return false;
        const character = S().character;
        if (!character) return false;

        try {
          await writeFile(disk, D.jsonFile, character);
          try { await mod.writeImage(character); }
          catch (error) { console.warn("[mainCharacter] could not write the profile image", error); }
          return true;
        } catch (error) {
          console.warn("[mainCharacter] folder write failed", error);
          return false;
        }
      },

      async connectFolder() {
        if (typeof global.showDirectoryPicker !== "function")
          throw new Error("Folder access needs Chrome or Edge (File System Access API).");

        const root = await global.showDirectoryPicker({ mode: "readwrite" });
        const characters = await root.getDirectoryHandle("characters", { create: true });
        disk = await characters.getDirectoryHandle(D.folder, { create: true });
        const wrote = await mod.writeToFolder();
        return { path: `characters/${D.folder}`, wrote };
      }
    };

    return mod;
  }

  global.createMainCharacterModule = createMainCharacterModule;
})(window);
