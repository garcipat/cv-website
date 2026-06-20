# Testing Guide

## Test Setup

- **Framework**: Vitest
- **Component testing**: React Testing Library + jsdom
- **Config**: `vitest.config.ts` (or inline in `vite.config.ts`)

## Test Types

| Layer | Use | Infrastructure |
|---|---|---|
| Unit | Pure utility functions in `src/lib/` | Vitest |
| Component | React components with rendered output | Vitest + React Testing Library + jsdom |

## Test Structure

- Follow: `{Method}_{Condition}_{ExpectedResult}` naming
- Use `// Arrange`, `// Act`, `// Assert` comments when a section has more than one line

Example:
```typescript
describe("PersonalitySection", () => {
  it("renders_name_and_tagline_when_data_provided", () => {
    // Arrange
    const data = { name: "John", tagline: "Developer", summary: "..." }

    // Act
    render(<PersonalitySection data={data} />)

    // Assert
    expect(screen.getByText("John")).toBeInTheDocument()
    expect(screen.getByText("Developer")).toBeInTheDocument()
  })
})
```

## Coverage Targets

| Layer | Target |
|---|---|
| Utilities (`src/lib/`) | 100% |
| Components (`src/components/`) | 80%+ |

## Running Tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

Note: Test scripts will be added to `package.json` during project setup.
