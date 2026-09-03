# Saved levels

JSON level files picked up by `../levelRegistry.ts` and offered in the Level
Editor's level dropdown. The editor's **Save** button writes straight into this
folder while `npm run dev` is running (see `vite/levelWritePlugin.ts`); reload
the editor and the new level is in the list. Without a dev server behind the
page, Save falls back to downloading the file — move it in here yourself.

Each file looks like:

```json
{
  "name": "Cave Run",
  "layout": [".S.", "GGG"]
}
```

The filename stem is the level's `id`, and `name` is what the dropdown shows.
A file that isn't an object, has no `layout`, or whose `layout` is not a
non-empty array of strings is skipped — the level simply doesn't appear, and
the rest of the list still loads.

The two built-in entries (`main`, `empty`) live in code, not here.

Levels saved here are committed like any other source file — delete the ones you
don't want to keep.
