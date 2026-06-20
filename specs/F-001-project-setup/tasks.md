# Tasks: Project Setup (F-001)

**Input**: Design documents from `/specs/F-001-project-setup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — Constitution II mandates TDD with smoke tests per plan.md implementation outline.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project root**: Configuration files (`.nvmrc`, `.prettierrc`, `vite.config.ts`, etc.)
- **Source**: `src/` for all application code
- **Tests**: Co-located with source files (`*.test.ts` / `*.test.tsx`)
- **Docs**: `docs/` directory, `README.md` at project root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Complete missing configuration artifacts and tooling that all user stories depend on.

- [ ] T001 [P] Create `.nvmrc` at project root with content `24` per `specs/F-001-project-setup/research.md`
- [ ] T002 Add `engines` field to `package.json` with `"node": ">=24.0.0"` and `"npm": ">=10.0.0"` (FR-013)
- [ ] T002b [P] Update `package.json` `"name"` from `"vite-scaffold"` to `"cv-website"`
- [ ] T003 Install `prettier` (^3.0.0) and `eslint-config-prettier` (^10.0.0) as devDependencies via `npm install -D prettier eslint-config-prettier`
- [ ] T004 [P] Create `.prettierrc` at project root with formatting rules: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100` per `specs/F-001-project-setup/research.md`
- [ ] T005 Integrate `eslint-config-prettier` into `eslint.config.js` (add to `extends` array) and add `"format": "prettier --write ."` script to `package.json` (FR-004)
- [ ] T006 [P] Add `VITE_BASE` environment variable support to `vite.config.ts` — refactor `defineConfig` to use a function that reads `process.env.VITE_BASE` with default `'/'` and applies it to the `base` option (FR-014, per `specs/F-001-project-setup/research.md` section 6)
- [ ] T007 [P] Update `<title>` in `index.html` from `vite-scaffold` to `CV — Patrick Garcia`

---

## Phase 2: Foundational (Testing Infrastructure)

**Purpose**: Install and configure Vitest + React Testing Library + jsdom. This phase MUST complete before any test tasks in subsequent phases.

**⚠️ CRITICAL**: No test writing can begin until this phase is complete.

- [ ] T008 Install test dependencies as devDependencies: `vitest` (^4.0.0), `@testing-library/react` (^16.3.0), `@testing-library/jest-dom` (^6.6.0), `jsdom` (^26.0.0), `@testing-library/user-event` (^14.6.0) — versions per `specs/F-001-project-setup/research.md` section 3
- [ ] T009 Create `vitest.config.ts` at project root extending `vite.config.ts` via `mergeConfig` with jsdom environment, `globals: true`, and `setupFiles: ['./src/test/setup.ts']` per `specs/F-001-project-setup/contracts/test-contract.md`
- [ ] T010 [P] Create `src/test/setup.ts` with `import '@testing-library/jest-dom/vitest'` to enable DOM matchers globally per `specs/F-001-project-setup/contracts/test-contract.md`
- [ ] T011 Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`

**Checkpoint**: Testing infrastructure ready — user story test writing can now begin

---

## Phase 3: User Story 1 - Scaffold the Development Environment (Priority: P1) 🎯 MVP

**Goal**: A developer can clone the repo, run `npm install && npm run dev`, and get a working React app with HMR and TypeScript error reporting.

**Independent Test**: Run `npm run dev`, open browser at localhost:5173, verify "CV" text renders. Edit `src/App.tsx`, verify browser updates within 2 seconds.

### Tests for User Story 1

> **NOTE: Write this test FIRST, ensure it FAILS before configuring if testing infrastructure is new.**
> 
> Actually, this test validates existing App.tsx so it should PASS immediately after test infra is set up.

- [ ] T012 [US1] Write smoke test `App renders without crashing` in `src/App.test.tsx` — renders `<App />`, asserts document contains "CV" text per `specs/F-001-project-setup/plan.md` implementation task 6. Manually verify HMR: edit `src/App.tsx`, save, confirm browser updates within 2 seconds (SC-007).

### Implementation for User Story 1

> The dev environment (Vite + React + HMR) is already scaffolded. T006 (VITE_BASE), T001 (`.nvmrc`), and T002 (`engines`) in Setup phase complete the dev environment requirements. T012 provides automated validation.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — `npm run dev` starts, HMR works, and smoke test passes.

---

## Phase 4: User Story 2 - Build for Production (Priority: P1)

**Goal**: `npm run build` type-checks all sources and produces optimized static output in `dist/`. `npm run preview` serves the production build correctly.

**Independent Test**: Run `npm run build`, verify exit code 0, verify `dist/index.html` and `dist/assets/` contain JS and CSS bundles.

### Implementation for User Story 2

> The production build (`tsc -b && vite build`) is already configured and working. T006 (VITE_BASE) in Setup enables sub-path deployment (FR-014). Verification task below validates the build contract.

- [ ] T013 [US2] Verify `npm run build` succeeds (exit code 0) and `dist/` output matches `specs/F-001-project-setup/contracts/build-contract.md` — confirm `dist/index.html` exists, JS/CSS bundles in `dist/assets/`, gzipped total < 200 KB, `@/` path aliases resolve correctly in production output, `npm run preview` serves the built output at localhost:4173

**Checkpoint**: Production build should complete successfully with type-checking enforced and optimized output.

---

## Phase 5: User Story 3 - Style with Tailwind CSS (Priority: P2)

**Goal**: Tailwind utility classes work in `.tsx` files out of the box — responsive variants, hover states, dark mode, and tree-shaking in production builds.

**Independent Test**: Add a Tailwind-styled element to `App.tsx`, verify visual styling in dev and production builds.

### Tests for User Story 3

- [ ] T014 [P] [US3] Write test `cn() merges Tailwind classes correctly` in `src/lib/utils.test.ts` — verify `cn()` resolves conflicts and merges classes using `clsx` + `tailwind-merge` per contract in `specs/F-001-project-setup/plan.md` implementation task 6
- [ ] T015 [P] [US3] Write test `Tailwind utility classes render correctly` in `src/App.test.tsx` — render a component with `bg-blue-500`, `hover:bg-blue-700`, `text-white`, `p-4`, `rounded-lg` and assert classes are present in the DOM per US3 acceptance scenario 3.1

### Implementation for User Story 3

> Tailwind CSS v4 is already configured via `@tailwindcss/vite` plugin with `@theme` block in `src/index.css`. No additional implementation tasks needed. Tests above provide validation.

**Checkpoint**: Tailwind CSS integration should be fully validated — utility classes render in dev, tree-shaken in production, `cn()` utility works.

---

## Phase 6: User Story 4 - Use shadcn/ui Components (Priority: P2)

**Goal**: Developers can add shadcn/ui components via `npx shadcn@latest add <name>`, import them, and use them with variant props in React components.

**Independent Test**: Run `npx shadcn@latest add button`, import `<Button>` in `App.tsx` with `variant="destructive"`, verify it renders with correct styling.

### Implementation for User Story 4

- [ ] T016 [US4] Add shadcn Button component by running `npx shadcn@latest add button` — validates `components.json` configuration and creates `src/components/ui/button.tsx` (FR-009)
- [ ] T017 [P] [US4] Write test `Button renders with variants` in `src/components/ui/button.test.tsx` — render `<Button variant="destructive">Delete</Button>`, assert it renders with destructive styling per US4 acceptance scenario 4.2 and `specs/F-001-project-setup/plan.md` implementation task 6
- [ ] T018 [US4] Integrate Button component into `src/App.tsx` — import and render a `<Button>` with a variant prop to validate the full import → render pipeline

**Checkpoint**: shadcn/ui integration should be validated — Button component added, renders with variants, import path `@/components/ui/button` resolves correctly.

---

## Phase 7: User Story 5 - Access Project Documentation (Priority: P3)

**Goal**: New contributors can open the `docs/` directory and `README.md` to find clear, complete documentation about the project.

**Independent Test**: Open each document in `docs/` and `README.md`, verify required sections are present and content is accurate.

### Implementation for User Story 5

> All five documentation files in `docs/` (Architecture.md, CodingGuidelines.md, Features.md, TestingGuide.md, RepositoryStructure.md) already exist and are complete per `specs/F-001-project-setup/data-model.md` section 8. Only README.md needs updating.

- [ ] T019 [US5] Update `README.md` with getting-started instructions: prerequisites (Node 24+, npm 10+), clone, install, dev, build, preview, lint, format, test commands, project layout, and link to `docs/` per `specs/F-001-project-setup/quickstart.md` and FR-011
- [ ] T019a [P] [US5] Verify all 5 `docs/` files (Architecture.md, CodingGuidelines.md, Features.md, TestingGuide.md, RepositoryStructure.md) contain required sections with complete content and no placeholder text (SC-005)

**Checkpoint**: All project documentation should be accessible and complete — a new contributor can onboard using `README.md` and `docs/`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that all success criteria are met across all user stories.

- [ ] T020 Run `npm run lint` and `npm run format` — both must pass with zero errors (SC-004)
- [ ] T021 Run `npm run build` and verify total gzipped output (HTML + JS + CSS) is under 200 KB (SC-002, SC-003)
- [ ] T022 Run `npm test` — all tests must pass, confirming App render, `cn()` utility, Tailwind classes, and Button component work correctly
- [ ] T023 Validate quickstart workflow: `git clone` → `npm install` → `npm run dev` completes in under 3 minutes (SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (needs `package.json` scripts structure ready) — BLOCKS all user story test tasks
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion for test infrastructure
  - US1 (Phase 3): Can start after Foundational — tests validate existing dev environment
  - US2 (Phase 4): Can start after Setup — verification task checks existing build
  - US3 (Phase 5): Can start after Foundational — writes component/utility tests
  - US4 (Phase 6): Can start after Foundational — adds Button component then writes tests
  - US5 (Phase 7): Can start after Setup — updates README.md
  - User stories can proceed in parallel (if staffed) or sequentially in priority order
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — validates existing dev scaffold. No dependencies on other stories.
- **User Story 2 (P1)**: Can start after Setup (Phase 1) — verifies existing build. No dependencies on other stories.
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — writes tests against existing `cn()` utility and Tailwind integration. No dependencies on other stories.
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) — adds shadcn Button and writes tests. No dependencies on other stories (but T018 modifies `App.tsx` which US1 tests depend on — coordinate carefully or write US4 tests before modifying App.tsx).
- **User Story 5 (P3)**: Can start after Setup (Phase 1) — updates README.md. No dependencies on other stories.

### Within Each User Story

- Tests MUST be written first (TDD per Constitution II)
- For US4: Add component via CLI before testing it
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001, T004, T006, T007 touch different files)
- All Foundational tasks marked [P] can run in parallel (T009, T010)
- Within US3: T014 and T015 can run in parallel (different test files)
- Within US4: T017 can run in parallel once T016 completes
- Once Foundational phase completes, US1, US3, US4, US5 can all start in parallel (different files)
- US2 can start in parallel with US1 (it only needs Setup, not Foundational)

---

## Parallel Example: User Story 3

```bash
# Launch both US3 tests together (different files):
Task: "Write test for cn() utility in src/lib/utils.test.ts"
Task: "Write test for Tailwind classes in src/App.test.tsx"
```

## Parallel Example: User Story 4

```bash
# After adding Button component:
Task: "Write Button render test in src/components/ui/button.test.tsx"
# Then integrate into App.tsx:
Task: "Integrate Button into src/App.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (configuration artifacts)
2. Complete Phase 2: Foundational (testing infrastructure — CRITICAL)
3. Complete Phase 3: User Story 1 (smoke test validates dev environment)
4. **STOP and VALIDATE**: `npm run dev` starts, HMR works, test passes
5. Dev environment is ready for feature development

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test passes → Dev environment validated (MVP!)
3. Add User Story 2 → Build verified → Production build confirmed
4. Add User Story 3 → Tailwind tests pass → Styling foundation validated
5. Add User Story 4 → shadcn Button works → Component library ready
6. Add User Story 5 → README updated → Onboarding complete
7. Polish → All success criteria verified

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (smoke test) + User Story 2 (build verification)
   - Developer B: User Story 3 (Tailwind tests) + User Story 4 (shadcn Button)
   - Developer C: User Story 5 (README)
3. Stories complete and integrate independently
4. Phase 8: Everyone runs final validation

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD: Write tests first where applicable, verify they fail/pass appropriately
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- The existing scaffold (Vite, React, TypeScript, Tailwind, shadcn config) provides a working foundation — tasks fill in remaining gaps
- `src/test/setup.ts` uses `@testing-library/jest-dom/vitest` (the Vitest-compatible import path for jest-dom v6+)
