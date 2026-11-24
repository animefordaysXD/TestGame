# Tutorial

`tutorial/tutorial.js` v0.1 keeps the opening checklist in the save. It does not gate play;
it records that the player has:

1. created a character,
2. arrived in the starting town,
3. taken a first action,
4. reached the tavern.

`tutorial/data.js` owns the labels and hints. `{start}` and `{tavern}` are replaced with the
authored names from `map/data.js`.

## Flow

```text
creator:created / mainCharacter:saved -> mark created
location:visited                      -> mark arrived; tavern name also marks travel
action:resolved                       -> mark action
travel:completed                      -> tavern destination marks travel

mark() -> tutorial:progress { step, steps, completed, updatedAtTick, completedAtTick }
```

Each step completes once and stays complete. `progress()` returns the counts used by the UI,
and `steps()` returns the token-filled labels/hints. Reset clears progress; save/load keeps
it.

## Adjust it

- Change text or hints: edit `tutorial/data.js`.
- Change what counts for a step: edit the subscriptions in `tutorial/tutorial.js`.
- Change the starting town or tavern: edit `map/data.js` (`world.start` / the tavern site).
- Change the visual checklist: edit the `#tutorial` block and `renderTutorial()` in
  `index.html`.
