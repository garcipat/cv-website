import type { ContactInfo } from '@/types/cv';

export interface ContactContentProps {
  data: ContactInfo;
}

export const ContactContent = ({ data }: ContactContentProps) => {
  return (
    <div className="flex flex-col items-center gap-2 max-w-xs mx-auto text-center">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        Contact
      </h3>
      <div className="space-y-1.5 text-center">
        {data.email && (
          <p className="text-[10px] text-[var(--muted-foreground)]">
            <a href={`mailto:${data.email}`} className="hover:text-[var(--primary)] transition-colors pointer-events-auto">
              {data.email}
            </a>
          </p>
        )}
        {data.phone && (
          <p className="text-[10px] text-[var(--muted-foreground)]">
            {data.phone}
          </p>
        )}
        {data.location && (
          <p className="text-[10px] text-[var(--muted-foreground)]">
            {data.location}
          </p>
        )}
        {data.website && (
          <p className="text-[10px]">
            <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline pointer-events-auto cursor-pointer">
              {data.website}
            </a>
          </p>
        )}
        {data.linkedin && (
          <p className="text-[10px]">
            <a href={data.linkedin} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline pointer-events-auto cursor-pointer">
              LinkedIn
            </a>
          </p>
        )}
        {data.github && (
          <p className="text-[10px]">
            <a href={data.github} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline pointer-events-auto cursor-pointer">
              GitHub
            </a>
          </p>
        )}
      </div>
    </div>
  );
};
