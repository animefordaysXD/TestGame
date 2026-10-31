/* Body content. Every character is divided into these ten parts, in display order.
   kind/side/parent describe the humanoid layout. vital marks a part whose loss would be
   life-threatening. defaultStatus is the starting per-character state; no combat, injury
   or equipment rule reads it yet. Edit labels/order here; the modules read this file. */
window.CharacterBodyData = {
  defaultStatus: "intact",

  parts: [
    { key: "head",      label: "Head",       kind: "head",  side: "center", parent: "torso",     vital: true },
    { key: "torso",     label: "Torso",      kind: "torso", side: "center", parent: null,        vital: true },
    { key: "leftLeg",   label: "Left leg",   kind: "leg",   side: "left",   parent: "torso",     vital: false },
    { key: "rightLeg",  label: "Right leg",  kind: "leg",   side: "right",  parent: "torso",     vital: false },
    { key: "leftArm",   label: "Left arm",   kind: "arm",   side: "left",   parent: "torso",     vital: false },
    { key: "rightArm",  label: "Right arm",  kind: "arm",   side: "right",  parent: "torso",     vital: false },
    { key: "leftHand",  label: "Left hand",  kind: "hand",  side: "left",   parent: "leftArm",   vital: false },
    { key: "rightHand", label: "Right hand", kind: "hand",  side: "right",  parent: "rightArm",  vital: false },
    { key: "leftFoot",  label: "Left foot",  kind: "foot",  side: "left",   parent: "leftLeg",   vital: false },
    { key: "rightFoot", label: "Right foot", kind: "foot",  side: "right",  parent: "rightLeg",  vital: false }
  ]
};
