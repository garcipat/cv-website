import type { Education } from '@/types/cv';
import { Keyword, Ident, Punct, ImportType, PropLine, Obj } from './syntax';

export const EducationSection = ({ education }: { education: Education[] }) => (
  <div>
    <div>
      <ImportType names={['Education']} from="../types" />
    </div>
    <div className="mb-2" />

    <div>
      <Keyword>export const </Keyword>
      <Ident>education</Ident><Punct>:</Punct> <Ident>Education</Ident><Punct>[]</Punct>
      <Punct> = [</Punct>
    </div>

    {education.map((edu, i) => (
      <Obj key={i}>
        <PropLine name="degree" value={edu.degree} />
        <PropLine name="institution" value={edu.institution} />
        <PropLine name="startDate" value={edu.startDate} />
        <PropLine name="endDate" value={edu.endDate ?? 'Ongoing'} />
        {edu.description && <PropLine name="description" value={edu.description} />}
      </Obj>
    ))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
