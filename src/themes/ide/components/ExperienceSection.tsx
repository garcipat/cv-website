import type { Experience } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType, PropLine, Obj } from './syntax';

function renderEntry(exp: Experience, index: number) {
  return (
    <Obj key={index}>
      <PropLine name="company" value={exp.company} />
      <PropLine name="role" value={exp.role} />
      <PropLine name="startDate" value={exp.startDate} />
      <PropLine name="endDate" value={exp.endDate ?? 'Present'} />
      {exp.location && <PropLine name="location" value={exp.location} />}

      <div className="ml-6">
        <Prop>highlights</Prop><Punct>:</Punct> <Punct>[</Punct>
      </div>
      {exp.highlights.map((h, j) => (
        <div key={j} className="ml-10">
          <Str>&quot;{h}&quot;</Str><Punct>,</Punct>
        </div>
      ))}
      <div className="ml-6"><Punct>]</Punct><Punct>,</Punct></div>
    </Obj>
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
