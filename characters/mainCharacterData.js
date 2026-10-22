/* Main-character content and limits. Edit freely: this is data, not logic. */
window.MainCharacterData = {
  genders: ["female", "male", "non-binary", "other"],
  ageRange: [1, 120],
  defaultAge: 25,
  nameMaxLength: 40,

  // First implemented stat. Location events with { stat: "stamina", delta } change it.
  staminaMax: 100,
  staminaStart: 100,

  // Uploaded portraits are centre-cropped to a square and resized before being stored.
  imageSize: 256,
  imageQuality: 0.86,
  maxUploadBytes: 8 * 1024 * 1024,

  // Folder mirror, relative to the folder containing index.html.
  folder: "mainChar",
  jsonFile: "main.json",
  imageBase: "profile"
};
