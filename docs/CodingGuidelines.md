# Coding Guidelines

## Conventions

- **Naming**: PascalCase for components and types, camelCase for variables and functions
- **Files**: Component files match component name (`PersonalitySection.tsx`)
- **Imports**: Use `@/` path alias for internal imports (configured by Vite + shadcn)
- **TypeScript**: Strict mode — no `any`, explicit types for all props and data
- **Components**: Arrow function components with `export const`, typed props destructured inline — no `FunctionComponent`/`FC` wrapper

## Component Structure

```tsx
import { cn } from "@/lib/utils"

interface SectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export const Section = ({ title, children, className = "" }: SectionProps) => {
  return (
    <section className={cn("py-8", className)}>
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </section>
  )
}
```

- Props interfaces defined in the same file, exported if reused
- `className` prop always optional, merged with `cn()` for composability
- Default export avoided — use named exports for consistency

## Tailwind Usage

- Use the `cn()` utility from `@/lib/utils` to merge conditional classes
- Keep markup readable: extract repeated patterns into components, not `@apply` directives
- Follow mobile-first responsive approach when layout is designed

## shadcn/ui

- Add components with `npx shadcn@latest add <name>`
- Never copy-paste shadcn components from other projects
- Never hand-edit files in `src/components/ui/` — override via props or wrapper components

## Data

- All CV content lives in `src/data/` as typed JSON
- Type definitions in `src/types/` — update types first, then data
- Components import data directly: `import cv from "@/data/cv"`

## Error Handling

- TypeScript strict mode catches data shape errors at build time
- No runtime data validation needed — JSON is committed code, not user input

## Security

- No secrets in the codebase — no backend, no API keys, no environment variables needed
- Static content only — no XSS vectors beyond React's built-in escaping
