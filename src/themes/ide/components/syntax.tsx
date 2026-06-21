import type { ReactNode } from 'react';

const c = (color: string) => ({ color }) as const;

export const Keyword = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-lavender)')}>{children}</span>;
export const Ident = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-blue)')}>{children}</span>;
export const Prop = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-green)')}>{children}</span>;
export const Str = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-red)')}>{children}</span>;
export const Punct = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-yellow)')}>{children}</span>;
export const LineComment = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-overlay)')}>{children}</span>;
export const Num = ({ children }: { children: ReactNode }) => <span style={c('var(--color-ctp-peach)')}>{children}</span>;

export const ImportType = ({ names, from }: { names: string[]; from: string }) => (
  <span>
    <Keyword>import </Keyword><Keyword>type </Keyword><Punct>{'{'}</Punct>
    {names.map((n, i) => (
      <span key={n}>
        {' '}<Ident>{n}</Ident>{i < names.length - 1 && <Punct>,</Punct>}
      </span>
    ))}
    {' '}<Punct>{'}'}</Punct><Keyword> from </Keyword><Str>&quot;{from}&quot;</Str><Punct>;</Punct>
  </span>
);
