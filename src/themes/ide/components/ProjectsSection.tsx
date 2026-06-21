import type { Project } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType } from './syntax';

function q(s: string) {
  return <Str>&quot;{s}&quot;</Str>;
}

function renderSkills(skills: { name: string }[]) {
  return (
    <>
      <div className="ml-6">
        <Prop>skills</Prop><Punct>:</Punct> <Punct>[</Punct>
      </div>
      {skills.map((s, i) => (
        <div key={i} className="ml-10">
          {q(s.name)}<Punct>,</Punct>
        </div>
      ))}
      <div className="ml-6"><Punct>]</Punct><Punct>,</Punct></div>
    </>
  );
}

export const ProjectsSection = ({ projects }: { projects: Project[] }) => (
  <div>
    <div>
      <ImportType names={['Project']} from="../types" />
    </div>
    <div className="mb-2" />

    <div>
      <Keyword>export const </Keyword>
      <Ident>projects</Ident><Punct>:</Punct> <Ident>Project</Ident><Punct>[]</Punct>
      <Punct> = [</Punct>
    </div>

    {projects.map((proj, i) => (
      <div key={i}>
        <div className="ml-2"><Punct>{'{'}</Punct></div>

        <div className="ml-6">
          <Prop>name</Prop><Punct>:</Punct> {q(proj.name)}<Punct>,</Punct>
        </div>
        <div className="ml-6">
          <Prop>description</Prop><Punct>:</Punct> {q(proj.description)}<Punct>,</Punct>
        </div>
        {proj.url && (
          <div className="ml-6">
            <Prop>url</Prop><Punct>:</Punct> {q(proj.url)}<Punct>,</Punct>
          </div>
        )}
        {proj.githubUrl && (
          <div className="ml-6">
            <Prop>githubUrl</Prop><Punct>:</Punct> {q(proj.githubUrl)}<Punct>,</Punct>
          </div>
        )}
        {proj.skills && proj.skills.length > 0 && renderSkills(proj.skills)}

        <div className="ml-2"><Punct>{'}'}</Punct><Punct>,</Punct></div>
      </div>
    ))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
