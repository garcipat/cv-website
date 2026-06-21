import type { Experience } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType } from './syntax';

function q(s: string) {
  return <Str>&quot;{s}&quot;</Str>;
}

function renderEntry(exp: Experience, index: number) {
  return (
    <div key={index}>
      <div className="ml-2"><Punct>{'{'}</Punct></div>

      <div className="ml-6">
        <Prop>company</Prop><Punct>:</Punct> {q(exp.company)}<Punct>,</Punct>
      </div>
      <div className="ml-6">
        <Prop>role</Prop><Punct>:</Punct> {q(exp.role)}<Punct>,</Punct>
      </div>
      <div className="ml-6">
        <Prop>startDate</Prop><Punct>:</Punct> {q(exp.startDate)}<Punct>,</Punct>
      </div>
      <div className="ml-6">
        <Prop>endDate</Prop><Punct>:</Punct> {q(exp.endDate ?? 'Present')}<Punct>,</Punct>
      </div>
      {exp.location && (
        <div className="ml-6">
          <Prop>location</Prop><Punct>:</Punct> {q(exp.location)}<Punct>,</Punct>
        </div>
      )}

      <div className="ml-6">
        <Prop>highlights</Prop><Punct>:</Punct> <Punct>[</Punct>
      </div>
      {exp.highlights.map((h, j) => (
        <div key={j} className="ml-10">
          {q(h)}<Punct>,</Punct>
        </div>
      ))}
      <div className="ml-6"><Punct>]</Punct><Punct>,</Punct></div>

      <div className="ml-2"><Punct>{'}'}</Punct><Punct>,</Punct></div>
    </div>
  );
}

export const ExperienceSection = ({ experience }: { experience: Experience[] }) => (
  <div>
    <div>
      <ImportType names={['Experience']} from="../types" />
    </div>
    <div className="mb-2" />

    <div>
      <Keyword>export const </Keyword>
      <Ident>experience</Ident><Punct>:</Punct> <Ident>Experience</Ident><Punct>[]</Punct>
      <Punct> = [</Punct>
    </div>

    {experience.map((exp, i) => renderEntry(exp, i))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
