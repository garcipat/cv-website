# Idea: Interactive Timeline Viewer

## Status: Design Exploration

## Summary

A new interactive "file" in the IDE theme file tree (`timeline.html`) that renders an interactive career timeline. The timeline shows colored segments for experience, education, and gaps, with a draggable diamond-shaped marker on an 8px-high track. Moving the marker reveals the content (highlights, details) of what was happening at that point in time, with the month/year displayed in a badge above the marker.

## Visual layout

```
        // career timeline — drag or click to explore

                ┌──────────┐
                │ Jul 2017 │    ← date badge (dark bg, yellow text, 1px border)
                └──────────┘

  2013     2016      2018       2021          2024    ← year ticks (8px, #585b70)

  |████████|░░░░|████████████|████████████|████████████|  ← 8px track
  |        |    |     ◆      |            |            |  ← course diamond on track
  |        |    |  ◆         |            |            |  ← marker diamond + hairline
  ─────────────────────────────────────────────────────
  Edu      Gap  PixelCraft   WebFlow     Tech Innov.     ← segment labels (8px)

  ┌──────────────────────────────────────────────────┐
  │ PixelCraft GmbH                     ← name (13px, green, bold)
  │ Frontend Developer · 2016-07 - 2018-02           ← role + period (10px, gray)
  │ Munich, Germany                                   ← location (10px, dimmer gray)
  │                                                   │
  │ • Developed responsive e-commerce checkout flows  │
  │ • Built automated visual regression testing suite │
  │                                                   │
  │ // courses taken near this period                 ← comment style
  │ TypeScript for Professionals — Egghead.io (2022)  ← course entry
  └──────────────────────────────────────────────────┘

  ▓ Education  ▓ Gap  ▓ Experience  ◇ Course    ← legend
```

## Data sources

- **Experience entries** — colored segments on the timeline (`startDate` → `endDate`), each with company, role, highlights, location, skills
- **Education entries** — colored segments (separate color from experience), each with degree, institution, description
- **Gaps** — periods between entries with no activity, rendered as grey segments labeled with the gap reason (e.g. "Travel")
- **Courses** — small diamond markers on the track, placed at their year position. Shown in the content card when the marker is within proximity (~6 months)

Segments are sized proportionally to their duration in months.

## Segment states

| State | Opacity | Effect |
|-------|---------|--------|
| Default (not active) | 35% | All segments dimmed to mute inactive periods |
| Active (marker inside) | 100% | Full brightness with subtle inner shadow glow |
| Gap (default) | 30% | Grey segments further dimmed |
| Gap (active) | 50% | Slightly brighter when marker is inside |

## Detailed dimensions

| Element | Size | Color |
|---------|------|-------|
| Track height | 8px | — |
| Track border radius | 4px | — |
| Year tick marks | 1px × 12px | `#585b70` |
| Division ticks between segments | 1px × 12px | `#585b70` |
| Marker diamond | 8px × 8px, rotated 45° | fill `#f38ba8`, border `#f9e2af` 1px |
| Marker hairline | 1px × 20px | `#f38ba8` at 0.7 opacity |
| Course diamond | 5px × 5px, rotated 45° | fill `#f9e2af`, border `#11111b` 1px |
| Date badge | 3px 14px padding, 3px radius | bg `#313244`, text `#f9e2af`, border `#45475a` |
| Content card | 4px radius, 16px padding | bg `#181825`, border `#313244` |
| Segment labels | 8px font | `#6c7086` (active: matching segment color, 600 weight) |

## Color coding

| Segment | Color | Default opacity |
|---------|-------|-----------------|
| Education | `#89b4fa` (blue) | 0.35 (active: 1.0) |
| Experience | `#a6e3a1` (green) | 0.35 (active: 1.0) |
| Current role | `#f9e2af` (yellow) | 0.35 (active: 1.0) |
| Gap | `#585b70` (grey) | 0.30 (active: 0.5) |

## Interaction

- **Click** anywhere on the timeline track to move the marker
- **Drag** the marker along the track
- **Hover** over segments shows a tooltip with the entry name
- Marker position snaps to the nearest month boundary
- **Above marker**: month and year badge (e.g. "Jul 2017")
- **Below marker**: content card showing the active entry at that point:
  - Company/institution name (green, bold)
  - Role/degree · Period (gray)
  - Location (if available, dim gray)
  - Highlights as bullet list
  - Skills on a single line (if available)
  - Courses taken near this period (shown as `// comment` block — see Courses section below)

## Courses on the timeline

- Courses (which only have a year, not a precise date) appear as **small diamond markers on the track** itself
- Diamond: 5px × 5px, rotated 45°, fill `#f9e2af` with 1px `#11111b` border for visibility on any background
- Placed at the approximate position of their year on the timeline
- When the marker is within ~6 months of a course, it appears in the content card as:
  ```
  // courses taken near this period
  TypeScript for Professionals — Egghead.io (2022)
  ```

## Gaps

- Any period between the end of one entry and the start of the next that exceeds 3 months is rendered as a gap segment
- Gap color: `#585b70` at 30% opacity (50% when active)
- Label below the track: "Gap" or the gap reason if known (e.g. "Travel")
- Content card when marker is on a gap: "Travel / sabbatical — 1 year" or similar description

## Edge cases

- **Present positions** (`endDate` undefined): segment extends to the current date
- **Overlapping entries**: show the primary entry (experience takes priority over education)
- **Very short segments** (< 1 month): render as a thin line with reduced opacity
- **Multiple courses near marker**: all shown in the comment block, one per line
- **No courses nearby**: omit the comment block entirely

## IDE integration

- Appears in the file tree as `timeline.html`
- Opens in the editor pane like any other section
- No tab needed — just a file in the tree (or could have a tab if user opens it)
- Other sections remain unaffected

## Data model considerations

- Gaps would benefit from an optional `TimelineBreak` type in the data model with a `reason` field
- Courses already have a `year` field; no data model change needed
- Optionally, experience/education could have a `type` discriminator to avoid overlap ambiguity

## Related feature

This design feeds into **S-004: Reusable timeline component** in the feature list, which is shared by Career (F-004) and Studies (F-007).
