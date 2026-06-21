import type { Personality, ContactInfo } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, LineComment, ImportType } from './syntax';

type Props = { personality: Personality; contact?: ContactInfo };

function q(s: string) {
  return <Str>&quot;{s}&quot;</Str>;
}

function renderContact(contact: ContactInfo) {
  const entries: [string, string][] = [];
  if (contact.email) entries.push(['email', contact.email]);
  if (contact.location) entries.push(['location', contact.location]);
  if (contact.github) entries.push(['github', contact.github]);
  if (contact.website) entries.push(['website', contact.website]);
  if (entries.length === 0) return null;
  return (
    <div>
      <Prop>contact</Prop><Punct>:{' {'}</Punct>
      {entries.map(([k, v]) => (
        <div key={k} className="ml-8">
          <Prop>{k}</Prop><Punct>:</Punct> {q(v)}<Punct>,</Punct>
        </div>
      ))}
      <div><Punct>{'}'}</Punct><Punct>,</Punct></div>
    </div>
  );
}

function renderSummary(summary: string) {
  const lines = summary.split('\n\n');
  if (lines.length <= 1) {
    return <div className="ml-4">{q(summary)}<Punct>,</Punct></div>;
  }
  return (
    <div>
      <div className="ml-4">{q(lines[0])}<Punct>,</Punct></div>
      {lines.slice(1).map((line, i) => (
        <div key={i} className="ml-4">
          <LineComment>// {line}</LineComment>
        </div>
      ))}
    </div>
  );
}

export const AboutSection = ({ personality, contact }: Props) => (
  <div>
    <div>
      <ImportType names={['Personality', 'ContactInfo']} from="./types" />
    </div>
    <div className="mb-2" />

    <div>
      <Keyword>export const </Keyword>
      <Ident>about</Ident>
      <Punct> = {'{'}</Punct>
    </div>

    <div className="ml-4">
      <Prop>name</Prop><Punct>:</Punct> {q(personality.name)}<Punct>,</Punct>
    </div>
    <div className="ml-4">
      <Prop>tagline</Prop><Punct>:</Punct> {q(personality.tagline)}<Punct>,</Punct>
    </div>
    <div className="ml-4">
      <Prop>bio</Prop><Punct>:</Punct>
    </div>
    {renderSummary(personality.summary)}
    {personality.favoriteQuote && (
      <div className="ml-4">
        <Prop>quote</Prop><Punct>:</Punct> {q(personality.favoriteQuote)}<Punct>,</Punct>
      </div>
    )}
    {contact && renderContact(contact)}

    <div><Punct>{'}'}</Punct><Punct>;</Punct></div>
  </div>
);
