import type { Personality, ContactInfo } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, LineComment, ImportType, PropLine } from './syntax';

type Props = { personality: Personality; contact?: ContactInfo };

function renderContact(contact: ContactInfo) {
  const entries: { name: string; value: string; href?: string }[] = [];
  if (contact.email) entries.push({ name: 'email', value: contact.email, href: `mailto:${contact.email}` });
  if (contact.location) entries.push({ name: 'location', value: contact.location });
  if (contact.github) entries.push({ name: 'github', value: contact.github, href: `https://github.com/${contact.github}` });
  if (contact.website) entries.push({ name: 'website', value: contact.website, href: contact.website });
  if (entries.length === 0) return null;
  return (
    <div>
      <Prop>contact</Prop><Punct>:{' {'}</Punct>
      {entries.map(({ name, value, href }) => (
        <PropLine key={name} name={name} value={value} href={href} />
      ))}
      <div><Punct>{'}'}</Punct><Punct>,</Punct></div>
    </div>
  );
}

function renderSummary(summary: string) {
  const lines = summary.split('\n\n');
  if (lines.length <= 1) {
    return <div className="ml-4"><Str>&quot;{summary}&quot;</Str><Punct>,</Punct></div>;
  }
  return (
    <div>
      <div className="ml-4"><Str>&quot;{lines[0]}&quot;</Str><Punct>,</Punct></div>
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

    <PropLine name="name" value={personality.name} />
    <PropLine name="tagline" value={personality.tagline} />
    <div className="ml-4">
      <Prop>bio</Prop><Punct>:</Punct>
    </div>
    {renderSummary(personality.summary)}
    {personality.favoriteQuote && (
      <>
        <div className="ml-4">
          <Prop>quote</Prop><Punct>:{' {'}</Punct>
        </div>
        <PropLine name="text" value={personality.favoriteQuote.text} />
        <PropLine name="author" value={personality.favoriteQuote.author} />
        <div className="ml-4"><Punct>{'}'}</Punct><Punct>,</Punct></div>
      </>
    )}
    {contact && renderContact(contact)}

    <div><Punct>{'}'}</Punct><Punct>;</Punct></div>
  </div>
);
