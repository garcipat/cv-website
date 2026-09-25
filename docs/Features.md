# Feature Dependency Map

Feature ideas and bugs are tracked as GitHub Issues, which are the source of truth for what to build and what is broken. Feature IDs use the work-type prefixes `F-NNN` (core), `S-NNN` (should have), `O-NNN` (optional), and `R-NNN` (refactoring); they appear in issue titles, and dependencies between features are recorded in the issue bodies. This file only holds the dependency map.

## Feature Dependencies

The following diagram shows feature dependencies and recommended implementation order:

```mermaid
graph RL
    F001["✅ F-001: Project Setup"]
    F002["✅ F-002: Data Model"]
    F003["✅ F-003: Space Theme"]
    F004["✅ F-004: Terminal Theme"]
    F010["✅ F-010: Design System"]
    F011["F-011: Page Layout"]
    F012["✅ F-012: Theme System"]
    F013["✅ F-013: Multilanguage"]
    F014["✅ F-014: IDE Theme"]
    S001["S-001: Print-Friendly"]
    S002["S-002: SEO Meta Tags"]
    S003["S-003: Scroll Animations"]
    S004["✅ S-004: Timeline Component"]
    S005["✅ S-005: Space Background Animations"]

    subgraph platformer["Platformer Theme"]
        F015["✅ F-015: 2D Platformer Theme"]
        F016["✅ F-016: Health & Respawn"]
        F017["✅ F-017: Enemies"]
        F018["✅ F-018: Destroyable Blocks"]
        F019["✅ F-019: Level Editor"]
        S007["✅ S-007: Chests & Completion"]
        S008["✅ S-008: Ladders & Climbing"]
        S009["✅ S-009: Onboarding & Controls"]
        S010["✅ S-010: Hurt Feedback"]
        O001["✅ O-001: Checkpoints"]
        O003["O-003: Tile Layers"]
        O004["✅ O-004: Container Blocks"]
        O005["✅ O-005: Hazards"]
        O006["O-006: Blueprint Rooms"]
        O007["O-007: Level Selection"]
        O008["O-008: Audio"]
        O009["✅ O-009: Background Image Layers"]
        O010["✅ O-010: Cave Lighting"]
        O011["✅ O-011: Deployable Ladders"]
        O012["✅ O-012: Bombs"]
        O013["✅ O-013: Wall Torches"]
        O014["✅ O-014: Background Tile Rework"]
        O015["✅ O-015: Editor Dark Mode"]
        O016["✅ O-016: Editor UI Rework"]
        O017["✅ O-017: Merge Pots of Different Colors"]
        O018["✅ O-018: Bouncy Mushroom Blocks"]
        O019["✅ O-019: Editor Zoom"]
        O020["✅ O-020: Floor Spear Hazard"]
        O021["✅ O-021: Floor Spikes"]
        O022["O-022: Ambient Background Clouds"]
        O023["✅ O-023: Crumbling Floor Blocks"]
        O024["✅ O-024: Enemy Movement & Animation Seam + Bee"]
        O025["O-025: Platformer Dart Trap"]
        O026["O-026: Platformer Poison Gas"]
        O027["✅ O-027: Platformer Falling Stalactite"]
        O028["✅ O-028: Cave Fog"]
        S011["S-011: Interact Hint Overlay"]
        S012["✅ S-012: Platformer Crouch/Duck"]
        S030["✅ S-030: Platformer Tile Meta Layer"]
        S031["✅ S-031: Platformer Torch Strength"]

        R001["✅ R-001: Platformer Core Contracts & Dependency Layers"]
        R002["✅ R-002: Platformer Shared Primitives & Dedup"]
        R003["✅ R-003: Platformer Abstract Light Sources"]
        R004["R-004: Platformer Transient Effect Registry"]
        R005["R-005: Platformer Generic Speech Bubble"]
        R006["R-006: Platformer Pickup Unification"]
        R007["R-007: Platformer Registry Dispatch Completion"]
        R008["R-008: Platformer Placeable World Items"]
        R009["R-009: Platformer Renderer Split"]
        R010["R-010: Platformer Mapper & Editor Unification"]
        R011["R-011: Platformer Player Damage & Bomb Systems"]
        R012["R-012: Platformer State Stores & Asset/HUD Extraction"]
        R013["R-013: Platformer Sprite Asset & Atlas Organization"]
        R014["R-014: Platformer Layer-Boundary Lint Guard"]
        R015["R-015: Platformer Tile Module Registry"]
    end

    F003 --> F002
    F003 --> F011
    F003 --> F012
    F003 --> F013
    F004 --> F002
    F004 --> F011
    F004 --> F012
    F004 --> F013
    F002 --> F001
    F010 --> F001
    F011 --> F010
    F012 --> F001
    F013 --> F001
    F013 --> F012
    F014 --> F012
    F014 --> F013
    F014 --> F002
    S001 --> F011
    S002 --> F001
    S003 --> F010
    S003 --> F011
    S004 --> F002
    S004 --> F010
    S005 --> F003
    F015 --> F002
    F015 --> F011
    F015 --> F012
    F015 --> F013
    F016 --> F015
    F017 --> F015
    F017 --> F016
    F018 --> F015
    F019 --> F015
    F019 --> F017
    F019 --> F018
    S007 --> F015
    S007 --> F017
    S008 --> F015
    S009 --> F015
    S010 --> F016
    S010 --> F017
    O003 --> F015
    O004 --> F015
    O004 --> F018
    O005 --> F015
    O005 --> F016
    O006 --> F019
    O007 --> F019
    O008 --> F015
    O009 --> F015
    O010 --> F015
    O010 --> F019
    O011 --> F015
    O011 --> F019
    O011 --> S008
    O012 --> F015
    O012 --> F017
    O012 --> F018
    O001 --> F015
    O013 --> F015
    O014 --> O009
    O014 --> O003
    O015 --> O010
    O015 --> F019
    O015 --> O016
    O015 --> F012
    O016 --> F019

    O017 --> O004
    O018 --> F015
    O019 --> F019
    O019 --> O006
    O020 --> F015
    O020 --> O005
    O020 --> F016
    O021 --> F015
    O021 --> O005
    O021 --> F016
    O023 --> F015

    O022 --> O009

    O024 --> F015
    O024 --> F017
    O024 --> F019

    O028 --> O010
    O028 --> O014

    S011 --> F015
    S011 --> S009
    S011 --> S007
    S011 --> O001
    S011 --> O011

    S012 --> F015
    S012 --> S008

    S030 --> F019
    S030 --> O006

    S031 --> S030
    S031 --> O010

    O025 --> F015
    O025 --> O005
    O025 --> S012

    O026 --> F015
    O026 --> O005
    O026 --> F016

    O027 --> F015
    O027 --> O005
    O027 --> F016

    R001 --> F015
    R002 --> R001
    R003 --> R001
    R003 --> R002
    R003 --> S031
    R004 --> R001
    R004 --> R002
    R004 --> O023
    R004 --> O027
    R005 --> R004
    R005 --> S011
    R005 --> O018
    R006 --> R001
    R006 --> R002
    R006 --> O012
    R007 --> R004
    R007 --> R006
    R007 --> O023
    R007 --> O027
    R007 --> O024
    R008 --> R006
    R008 --> R007
    R008 --> R015
    R008 --> O012
    R009 --> R003
    R009 --> R004
    R009 --> R008
    R009 --> R015
    R009 --> O014
    R010 --> R002
    R010 --> O015
    R010 --> O016
    R010 --> O019
    R010 --> R015
    R010 --> S030
    R011 --> R007
    R011 --> R008
    R011 --> O012
    R012 --> R009
    R012 --> R011
    R013 --> F015
    R014 --> R001
    R015 --> R001
    R015 --> R004

    classDef done stroke:#FFD600,stroke-width:3px
    classDef projectSetup fill:#1565C0,color:#ffffff
    classDef layoutNavigation fill:#E65100,color:#ffffff
    classDef themeInfrastructure fill:#6A1B9A,color:#ffffff
    classDef themes fill:#00838F,color:#ffffff
    classDef enhancements fill:#AD1457,color:#ffffff

    class F001 done
    class F002 done
    class F001,F002 projectSetup
    class F010 done
    class F012 done
    class F013 done
    class F003 done
    class F004 done
    class F003,F004,F014 themes
    class F011,S001,S003 layoutNavigation
    class F012,F013 themeInfrastructure
    class F014 done
    class S004 done
    class S002,S005,O001 enhancements
    class O001 done
    class S005 done
    class F015,F016,F017,F018,S007,S008,S009,S010,O003,O004,O005,O008,O009,O013,O014,O020,O021,O023 themes
    class O022 themes
    class S011 themes
    class O024 themes
    class O024 done
    class S012 themes
    class S012 done
    class S030 enhancements
    class S030 done
    class S031 done
    class O025 themes
    class O026 themes
    class O027 themes
    class O027 done
    class O028 themes
    class O028 done
    class O017 themes
    class O017 done
    class O018 themes
    class O018 done
    class F019,O006,O007,O010,O011,O012,O015,O016,O019,S030,S031 enhancements
    class O019 done
    class O020 themes
    class O020 done
    class O012 done
    class F015,F016,F017,F018,F019,S007,S008,S009,S010,O004,O005,O009 done
    class O013 done
    class O010 done
    class O011 done
    class O014 themes
    class O014 done
    class O015 enhancements
    class O015 done
    class O016 enhancements
    class O016 done
    class O021 done
    class O023 done
    class R001,R002,R003,R004,R005,R006,R007,R008,R009,R011,R012,R014,R015 themes
    class R001 done
    class R002 done
    class R010 enhancements
    class R013 themes
```

**Critical Path**: F-001 → F-012 → F-013 → F-002 → F-014 (foundation → theme system → multilanguage → data model → IDE theme, then Space and Terminal themes)
