# Idea: 3D Room Theme

## Status: Design Exploration

## Summary

A pseudo-3D immersive theme where CV sections appear as floating panels in a spatial "room." As the user scrolls, panels fade in from behind and slide into position with parallax depth — like panes of glass floating through space. Dark background, atmospheric lighting, depth cues.

## Concept

The page creates a 3D-like sensation using CSS transforms, parallax scrolling, and opacity fades. Sections are not stacked vertically in the traditional sense — they exist at different "depths" and the scroll motion brings them forward into view.

```
        ┌─────────┐
        │ Contact │  ← farthest back, smallest
        └─────────┘
       ┌───────────┐
       │ Personality│  ← mid-depth
       └───────────┘
      ┌──────────────┐
      │   Skills     │  ← mid-depth
      └──────────────┘
     ┌─────────────────┐
     │    Projects     │  ← closer
     └─────────────────┘
    ┌────────────────────┐
    │    Experience      │  ← closer
    └────────────────────┘
   ┌───────────────────────┐
   │  About / Hero         │  ← foreground, full size
   └───────────────────────┘
         ▲ scroll direction ▲
```

## Key Effects

- **Parallax depth**: Far panels move slower on scroll, near panels move faster
- **Scale progression**: Far panels start smaller, grow to full size as they reach the foreground
- **Opacity fade-in**: Panels start translucent, become fully opaque as they approach
- **Z-axis stacking**: CSS `translateZ` and `perspective` create the spatial illusion
- **Background**: Dark gradient or subtle grid/particles for depth reference
- **Panel styling**: Glass-morphism (frosted glass with blur), subtle borders, shadows

## Navigation

- Scroll-driven — no tabs or sidebar
- Sections appear in a predefined order as the user scrolls
- Could add "skip to section" dots or a mini-nav indicator
- Each panel becomes "active" when it reaches the focus plane

## Considerations

- **Performance**: Heavy use of CSS transforms and `will-change` — needs testing
- **Accessibility**: `prefers-reduced-motion` should flatten the 3D effect into a simple stack
- **Content density**: Panels need to be concise — not suited for dense text
- **Browser support**: CSS `perspective` and `transform: translateZ()` are well-supported in modern browsers

## Desktop-First

This theme relies heavily on scroll interaction and spatial depth — designed for desktop with a mouse/trackpad.
