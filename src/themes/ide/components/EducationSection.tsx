import type { Education } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType } from './syntax';

function q(s: string) {
  return <Str>&quot;{s}&quot;</Str>;
}

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
      <div key={i}>
        <div className="ml-2"><Punct>{'{'}</Punct></div>

        <div className="ml-6">
          <Prop>degree</Prop><Punct>:</Punct> {q(edu.degree)}<Punct>,</Punct>
        </div>
        <div className="ml-6">
          <Prop>institution</Prop><Punct>:</Punct> {q(edu.institution)}<Punct>,</Punct>
        </div>
        <div className="ml-6">
          <Prop>startDate</Prop><Punct>:</Punct> {q(edu.startDate)}<Punct>,</Punct>
        </div>
        <div className="ml-6">
          <Prop>endDate</Prop><Punct>:</Punct> {q(edu.endDate ?? 'Ongoing')}<Punct>,</Punct>
        </div>
        {edu.description && (
          <div className="ml-6">
            <Prop>description</Prop><Punct>:</Punct> {q(edu.description)}<Punct>,</Punct>
          </div>
        )}

        <div className="ml-2"><Punct>{'}'}</Punct><Punct>,</Punct></div>
      </div>
    ))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
