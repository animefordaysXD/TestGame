/* Tutorial content shown on the game page. This is data, not logic.
   Step keys must stay `created`, `arrived`, `action` and `travel`; the tutorial module
   listens for the matching game events. `{start}` and `{tavern}` are replaced with the
   authored site names from map/data.js by the UI. Keep the object below strict JSON
   (quoted keys, no comments, no trailing commas); put notes in this header instead. */
window.TutorialData = {
  "title": "Tutorial",
  "startText": "Your story begins in {start}.",
  "completeText": "Tutorial complete. Explore the map, scavenge for gear, or travel onward.",
  "steps": [
    {
      "key": "created",
      "label": "Create your character",
      "hint": "Choose a background, origin and focus, then create the character."
    },
    {
      "key": "arrived",
      "label": "Arrive in {start}",
      "hint": "The road is opening. Your starting town will appear shortly."
    },
    {
      "key": "action",
      "label": "Take your first action",
      "hint": "Open the Actions panel and choose Scout or Scavenge."
    },
    {
      "key": "travel",
      "label": "Travel to {tavern}",
      "hint": "Open Actions, choose Travel, and pick {tavern}."
    }
  ]
};
