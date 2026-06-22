import type { Project } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType, PropLine, Obj } from './syntax';

function renderSkills(skills: string[]) {
  return (
    <>
      <div className="ml-6">
        <Prop>skills</Prop><Punct>:</Punct> <Punct>[</Punct>
      </div>
      {skills.map((s, i) => (
        <div key={i} className="ml-10">
          <Str>&quot;{s}&quot;</Str><Punct>,</Punct>
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
      <Obj key={i}>
        <PropLine name="name" value={proj.name} />
        <PropLine name="description" value={proj.description} />
        {proj.url && <PropLine name="url" value={proj.url} href={proj.url} />}
        {proj.githubUrl && <PropLine name="githubUrl" value={proj.githubUrl} href={proj.githubUrl} />}
        {proj.skills && proj.skills.length > 0 && renderSkills(proj.skills)}
      </Obj>
    ))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
