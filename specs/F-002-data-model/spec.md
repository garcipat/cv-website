# Feature Specification: Data Model

**Feature Branch**: `F-002-data-model`  
**Created**: 2026-06-20  
**Status**: Draft  
**Input**: User description: "F-002 — Data model: TypeScript types + JSON files for CV content"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Define CV Content Types (Priority: P1)

A developer needs a complete set of TypeScript interfaces that describe all CV content sections (personality, career, skills, courses, education, certificates, projects). They open `src/types/cv.ts` and find well-named, strictly-typed interfaces with JSDoc comments explaining each field's purpose. TypeScript's compiler enforces these types across all data files and consuming components.

**Why this priority**: Types are the contract between data and presentation. Every content-rendering feature (F-003 through F-009) imports from these types. With them, every content component has a type-safe foundation.

**Independent Test**: Import `CVData` and each sub-type in a test file, construct a valid object literal, verify TypeScript compiles without errors. Introduce an intentional type mismatch (wrong field type, missing required field) and verify `tsc` reports the error at the exact location.

**Acceptance Scenarios**:

1. **Given** the `src/types/cv.ts` file exists, **When** a developer imports `CVData` and destructures its properties, **Then** TypeScript auto-completion shows all available fields with correct types.
2. **Given** a JSON file claims to be `CVData`, **When** it lacks a required field or has a mistyped value, **Then** `npm run build` (which includes `tsc`) fails with a clear error identifying the file and field.
3. **Given** the types are defined, **When** a developer writes a component that accesses `cv.experience[0].company`, **Then** TypeScript infers the return type as `string` without requiring explicit annotation.
4. **Given** an optional field (e.g., `endDate` for a current position), **When** it is omitted from the JSON data, **Then** TypeScript accepts it and the consuming code handles `undefined` correctly.

---

### User Story 2 - Populate CV Content in English (Priority: P1)

A content author (developer or CV owner) opens `src/data/cv.en.json` and enters their CV information in English. They fill in personality details, career history, skills, courses, education, certificates, and personal projects. Every field they type is validated by the TypeScript compiler against the `CVData` type, preventing structural mistakes.

**Why this priority**: The English CV is the primary content — the website's reason for existing. All presentation features render this data. German content can follow the same structure later.

**Independent Test**: Create `cv.en.json` with at least one populated entry per section, run `npm run build`, verify the build compiles cleanly.

**Acceptance Scenarios**:

1. **Given** an empty `src/data/cv.en.json`, **When** the author populates the `personality` object with name, tagline, and summary strings, **Then** the build passes and consuming components can access `cv.personality.name`.
2. **Given** the author adds a career entry with `company`, `role`, `startDate`, `endDate`, and `highlights` array, **When** they run the build, **Then** it compiles cleanly.
3. **Given** the author adds a skill category with multiple skills each having a `name` and `level` (0-100), **When** they run the build, **Then** the numeric `level` field is validated as a number.
4. **Given** the JSON file is populated, **When** the author opens it in VS Code (or any editor with JSON Schema support), **Then** the file is recognized as valid JSON and conforms to the expected structure.

---

### User Story 3 - Populate CV Content in German (Priority: P2)

A content author copies the English `cv.en.json` structure and writes a German version in `src/data/cv.de.json`. The file uses the identical `CVData` type, ensuring structural consistency across languages. Fields containing language-independent data (dates, URLs, company names, tech stack names) may be identical between the two files, while descriptive text (summaries, highlights, role titles) is translated.

**Why this priority**: German support is a core requirement (F-013 Multilanguage), but the website is functional with English-only content. The data model must support two files from the start.

**Independent Test**: Create `cv.de.json` with German translations, run `npm run build`, verify both `cv.en.json` and `cv.de.json` pass type-checking with identical structure.

**Acceptance Scenarios**:

1. **Given** `cv.en.json` is complete, **When** the author creates `cv.de.json` with the same JSON structure but German text content, **Then** both files pass `tsc` type-checking against the `CVData` type.
2. **Given** the active locale signal is set to `"de"`, **When** a component reads `currentCV.value.personality.name`, **Then** it receives the German name from `cv.de.json`.
3. **Given** a structural change is made to `CVData` (e.g., adding a new required field), **When** `npm run build` is executed, **Then** both `cv.en.json` and `cv.de.json` must satisfy the updated type or the build fails for both.

---

### User Story 4 - Type-Safe Data Import in Components (Priority: P2)

A component developer building the Career section (F-004) imports the CV data and iterates over the experience array. They receive full TypeScript IntelliSense for every field — `company`, `role`, `startDate`, `highlights` — without needing to look up the type definition. Array methods like `.map()`, `.filter()`, and `.sort()` work with correctly inferred element types.

**Why this priority**: Developer experience directly impacts feature velocity. Type-safe imports eliminate a whole class of runtime bugs before they happen.

**Independent Test**: Write a test component that imports `cvEn` (or `cvDe`), maps over `experience`, and renders each entry. Verify TypeScript infers all types correctly with zero assertions or `any` casts.

**Acceptance Scenarios**:

1. **Given** a component imports `{ cvEn } from '@/data/cv.en'` (the wrapper module), **When** the developer types `cvEn.experience[0].`, **Then** the IDE autocompletes with `company`, `role`, `startDate`, `endDate`, `highlights`, and `location`.
2. **Given** a developer maps over `cvEn.skills`, **When** they access `category.skills[0].level`, **Then** TypeScript treats `level` as `number` and flags any attempt to assign a string.
3. **Given** a developer writes `cvEn.certificates.filter(c => c.date > '2023')`, **When** they run `tsc`, **Then** the comparison between `string` (date) and `string` (literal) is valid because both are strings.

---

### Edge Cases

- ✅ **Empty arrays**: When a section contains zero entries (e.g., zero certificates, zero courses), the JSON file contains an empty array `[]`. Components render gracefully (skip the section or show a placeholder message). TypeScript validates this is still a valid `Certificate[]` or `Course[]`.
- ✅ **Ongoing positions**: When a career or education entry has no `endDate` (current position), the optional `endDate?: string` field is absent. Components interpret `undefined` as "present" and render accordingly.
- ✅ **Missing optional fields**: Fields like `contact.email`, `project.url`, or `certificate.url` may be absent. Components use optional chaining (`?.`) or conditionals to handle missing data without crashes.
- ✅ **Single-entry arrays**: A section with exactly one entry renders correctly — the same logic handles single and multiple items identically.
- ✅ **Long text fields**: Fields like `summary` or `highlights` entries may contain multi-paragraph text. The data model stores them as plain strings; components are responsible for rendering (e.g., splitting on newlines, applying markdown if desired).
- ✅ **Duplicate data between locales**: Dates, URLs, company names, and tech stacks are typically identical across languages. Authors may copy-paste these fields between `cv.en.json` and `cv.de.json`. TypeScript accepts duplicate values — this is an authoring convenience.
- ✅ **Skill level boundaries**: Skill `level` values are defined as 0-100. Components rendering skill bars/indicators must clamp or handle out-of-range values gracefully. TypeScript's `number` type doesn't enforce range constraints — validation is a component responsibility.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST define a `CVData` interface in `src/types/cv.ts` that serves as the root type for all CV content, containing typed sections for personality, experience, skills, courses, education, certificates, and projects.
- **FR-002**: System MUST define a standalone, exported `ContactInfo` interface with `email`, `phone`, `location`, `website`, `linkedin`, and `github` (all optional strings). System MUST also define a `Personality` interface with `name` (string), `tagline` (string), `summary` (string), and an optional `favoriteQuote` (string). The `ContactInfo` is a separate top-level optional field on `CVData`.
- **FR-003**: System MUST define an `Experience` interface with `company` (string), `role` (string), `startDate` (string, format YYYY-MM), optional `endDate` (string, format YYYY-MM — absent means current position), `highlights` (string array), optional `location` (string), and optional `skills` (array of `Skill` objects — key skills used in this role with proficiency level).
- **FR-004**: System MUST define a `SkillCategory` interface with `category` (string) and `skills` array of `Skill` objects, each containing `name` (string) and `level` (integer, 0-100 scale).
- **FR-005**: System MUST define a `Course` interface with `title` (string), `provider` (string), `year` (number), and optional `certificate` (string, for certificate URL or name).
- **FR-006**: System MUST define an `Education` interface with `degree` (string), `institution` (string), `startDate` (string, YYYY-MM), optional `endDate` (string, YYYY-MM), and optional `description` (string).
- **FR-007**: System MUST define a `Certificate` interface with `name` (string), `issuer` (string), `date` (string, YYYY-MM), optional `url` (string), and optional `credentialId` (string).
- **FR-008**: System MUST define a `Project` interface with `name` (string), `description` (string), optional `skills` (array of `Skill` objects — key skills demonstrated by this project with proficiency level), optional `url` (string), optional `githubUrl` (string), and optional `imageUrl` (string).
- **FR-009**: System MUST export all interfaces from `src/types/cv.ts` so they are importable by data files, components, and tests.
- **FR-010**: System MUST provide an English CV data file at `src/data/cv.en.json` that conforms to the `CVData` type.
- **FR-011**: System MUST provide a German CV data file at `src/data/cv.de.json` that conforms to the `CVData` type with German-language content in translatable fields.
- **FR-012**: System MUST ensure that `tsc` (TypeScript compiler, invoked via `npm run build`) validates both `cv.en.json` and `cv.de.json` against the `CVData` type using `resolveJsonModule` and `strict` mode — any type mismatch causes a build failure.
- **FR-013**: System MUST include JSDoc comments on each interface and field in `src/types/cv.ts` describing the expected content, format, and any constraints (e.g., date format, skill level range).
- **FR-014**: System MUST populate `cv.en.json` with realistic sample data (placeholder names, companies, and descriptions — not lorem ipsum) that exercises every type and field, including at least 2 entries in each array section and at least one entry using all optional fields.

### Key Entities

- **CVData**: The root data structure. Contains all sections as typed properties, including an optional top-level `contact` field. Imported by the locale signal (`currentCV`) and consumed by all theme layout components.
- **ContactInfo**: The CV owner's contact details — all optional strings for email, phone, location, website, LinkedIn, and GitHub. Defined as a standalone exported interface and an independent top-level optional field on `CVData` (separate from `Personality`). Components can import it directly for contact-specific rendering (e.g., a contact card).

- **Personality**: The CV owner's identity — name, professional tagline, a multi-sentence summary, and an optional favorite quote. Does NOT contain contact details; those live separately under `CVData.contact`.
- **Experience**: A career timeline entry representing one job or role — company name, role title, start/end dates (YYYY-MM format, endDate optional for current positions), location, a list of highlight bullet points describing achievements, and an optional list of key skills used in this role (with proficiency levels).
- **SkillCategory**: A named group of related skills (e.g., "Frontend", "Backend", "DevOps"). Each skill within the category has a name and a proficiency level on a 0-100 scale.
- **Course**: A completed training course or certification program — title, provider, completion year, and an optional link or certificate identifier.
- **Education**: A formal education entry — degree name, institution, attendance period (start/end dates, endDate optional if ongoing), and an optional description.
- **Certificate**: An earned professional certification — certificate name, issuing organization, date awarded, optional verification URL, and optional credential ID.
- **Project**: A personal or professional project — name, description, optional list of key skills demonstrated (with proficiency levels), optional live URL, optional source code URL, and optional image URL.

**Entity Relationships**:
```
CVData
 ├── personality: Personality (1:1)
 ├── contact: ContactInfo (1:1, optional)
 ├── experience: Experience[] (1:N)
 ├── skills: SkillCategory[] (1:N)
 │       └── skills: Skill[] (1:N)
 ├── courses: Course[] (1:N)
 ├── education: Education[] (1:N)
 ├── certificates: Certificate[] (1:N)
 └── projects: Project[] (1:N)
```

All relationships are compositional — each section is a direct property of `CVData`. All entities are self-contained (e.g., a project stands alone without skill references; a certificate stands alone without course references).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can import `CVData` from `@/types/cv`, construct a valid object with all sections populated, and have TypeScript accept it with zero errors.
- **SC-002**: Introducing a deliberate type error in `cv.en.json` (e.g., `"name": 123` instead of a string) causes `npm run build` to fail with a TypeScript error that identifies the offending file and line.
- **SC-003**: `src/types/cv.ts` exports exactly 10 named interfaces — `CVData`, `ContactInfo`, `Personality`, `Experience`, `SkillCategory`, `Skill`, `Course`, `Education`, `Certificate`, `Project` — all importable individually.
- **SC-004**: Both `cv.en.json` and `cv.de.json` pass `tsc` type-checking when `strict: true` is enabled, with all sections containing at least one entry each.
- **SC-005**: Every exported interface and every field in `src/types/cv.ts` has a JSDoc comment that describes its purpose, expected format, and any constraints. Verified by code review: each `export interface` and each field line is immediately preceded or followed by a `/** ... */` block.
- **SC-006**: The `CVData` type and its sub-types cover all content sections planned for features F-003 through F-009 (personality, career timeline, skills, courses, education, certificates, projects) — every content section has a type today.
- **SC-007**: All arrays default to empty `[]` when entries are absent; components always call `.length` and `.map()` on defined arrays that safely return 0 or `[]`.

## Assumptions

- **Date format**: All date fields use `YYYY-MM` string format (e.g., `"2020-03"`) — precise enough for month-level granularity while keeping data entry simple. This is a documented convention in JSDoc comments.
- **Skill level range**: 0-100 integer scale (0 = beginner, 100 = expert). This is documented in JSDoc; runtime clamping belongs to each component's responsibility.
- **Ongoing positions**: `endDate` fields are optional — when absent, the position is considered current/present. Components render "Present" or equivalent.
- **Language-independent fields**: Dates, URLs, email addresses, GitHub handles, tech stack names, and company names are typically identical across `cv.en.json` and `cv.de.json`. No mechanism exists to share these fields between files — authors maintain both files independently.
- **Contact info**: Contact details are a separate top-level `contact` field on `CVData` (independent from `personality`). This allows contact information to be rendered independently from the personality introduction, and keeps `Personality` focused on identity/narrative.
- **Sample data**: `cv.en.json` will contain realistic but fictional sample data (not lorem ipsum) to demonstrate the data model and provide a starting point for content authors. Names, companies, and descriptions will be clearly placeholder.
- **Compile-time validation**: JSON files are imported directly via `resolveJsonModule`. Shape consistency between `cv.en.json` and `cv.de.json` is validated at the `Record<Locale, CVData>` assignment site in F-013's locale signal — JSON imports are direct, with no intermediate abstraction.
- **Self-contained entities**: Entities are independent of each other. For example, a `Project` stands alone; a `Certificate` stands alone. If relationships are needed later, they can be added as optional fields while keeping existing data intact.
- **File encoding**: JSON files use UTF-8 encoding. Special characters (umlauts, accents, emoji) are stored directly, not as Unicode escape sequences.
- **Data directory structure**: Both `cv.en.json` and `cv.de.json` live directly in `src/data/` as flat locale files. The file naming convention (`cv.{locale}.json`) aligns with the `src/i18n/` structure planned for UI translations.
