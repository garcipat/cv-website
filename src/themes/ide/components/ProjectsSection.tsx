import type { Project } from '@/types/cv';

export const ProjectsSection = ({ projects }: { projects: Project[] }) => (
  <>
    {projects.map((proj, i) => (
      <div key={i} className="mb-4">
        <div className="text-[var(--ide-label-color)] font-medium">{proj.name}</div>
        <p className="text-[var(--ide-value-color)] text-sm mb-1">{proj.description}</p>
        {proj.techStack.length > 0 && (
          <div className="text-sm mb-1">
            <span className="text-[var(--ide-date-color)]">tech: </span>
            <span className="text-[var(--ide-value-color)]">{proj.techStack.join(', ')}</span>
          </div>
        )}
        <div className="flex gap-3 text-sm">
          {proj.url && (
            <a href={proj.url} target="_blank" rel="noopener noreferrer" className="text-[var(--ide-link-color)] hover:underline">
              {proj.url}
            </a>
          )}
          {proj.githubUrl && (
            <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--ide-link-color)] hover:underline">
              {proj.githubUrl}
            </a>
          )}
        </div>
      </div>
    ))}
  </>
);
