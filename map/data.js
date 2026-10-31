/* Map spawner content. Edit freely: this is data, not logic.
   The map module asks the locations module to spawn `defaultLocationCount` random
   locations plus the fixed landmarks below. Landmarks are intentionally simple
   placeholders for now; give each one a real biome/effects later. */
window.MapData = {
  defaultLocationCount: 20,
  minLocationCount: 0,
  maxLocationCount: 100,

  // These three are guaranteed on every generated map, regardless of the random rolls.
  // `kind` is stored on the location so future systems can find the tavern/castle/shack.
  landmarks: [
    {
      kind: "tavern", name: "The Broken Wheel", biome: "Landmark", biomeKey: "landmark",
      weather: "Clear", hostility: 5
    },
    {
      kind: "castle", name: "Greywatch Castle", biome: "Landmark", biomeKey: "landmark",
      weather: "Clear", hostility: 20
    },
    {
      kind: "shack", name: "Abandoned Shack", biome: "Landmark", biomeKey: "landmark",
      weather: "Overcast", hostility: 10
    }
  ]
};
