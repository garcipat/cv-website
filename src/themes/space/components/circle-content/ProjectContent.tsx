import type { Project } from '@/types/cv';

export interface ProjectContentProps {
  data: Project;
}

export const ProjectContent = ({ data }: ProjectContentProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 max-w-md mx-auto text-center">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {data.name}
      </h3>
      <p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">
        {data.description}
      </p>
      {data.skills && data.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center mt-1">
          {data.skills.map((s, i) => (
            <span
              key={i}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-3 justify-center mt-1">
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--accent)] hover:underline"
          >
            Live Demo
          </a>
        )}
        {data.githubUrl && (
          <a
            href={data.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--accent)] hover:underline"
          >
            GitHub
          </a>
        )}
      </div>
    </div>
  );
};
