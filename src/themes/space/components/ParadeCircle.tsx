import { cn } from '@/lib/utils';
import type { CircleEntry, CircleTransform } from '../parade-utils';
import { AboutContent } from './circle-content/AboutContent';
import { ExperienceContent } from './circle-content/ExperienceContent';
import { ProjectContent } from './circle-content/ProjectContent';
import { SkillCategoryContent } from './circle-content/SkillCategoryContent';
import { EducationContent } from './circle-content/EducationContent';
import { CourseContent } from './circle-content/CourseContent';
import { CertificateContent } from './circle-content/CertificateContent';
import { ContactContent } from './circle-content/ContactContent';
import type { Personality, Experience, Project, SkillCategory, Education, Course, Certificate, ContactInfo } from '@/types/cv';

export interface ParadeCircleProps {
  entry: CircleEntry;
  transform: CircleTransform;
  isSettled: boolean;
}

/**
 * Renders a single circle in the parade pool.
 *
 * Matches mockup structure:
 *   .circle-wrap  — absolute on stage, translateX/Y, opacity
 *     .circle     — absolute, translate(-50%,-50%) scale(), glass styling
 *       .content  — opacity, transition
 */
/** Per FR-019: standard circle for content-heavy entries, compact for light ones. */
function circleSize(type: CircleEntry['type']): string {
  switch (type) {
    case 'about':
    case 'experience':
    case 'project':
    case 'skillCategory':
    case 'education':
      return 'w-[33vw] h-[33vw]';
    case 'course':
    case 'certificate':
    case 'contact':
      return 'w-[28vw] h-[28vw]';
  }
}

export const ParadeCircle = ({ entry, transform, isSettled }: ParadeCircleProps) => {
  const content = renderContent(entry);

  return (
    <div
      className={cn(
        'absolute',
        'left-1/2 top-[52%]',
        'w-0 h-0',
      )}
      style={{
        transform: `translateX(${transform.translateX}vw) translateY(${transform.translateY}vh)`,
        opacity: transform.wrapperOpacity,
        zIndex: isSettled ? 20 : 10,
      }}
    >
      <div
        className={cn(
          'absolute left-1/2 top-1/2',
          'flex items-center justify-center',
          'rounded-[50%]',
          circleSize(entry.type),
          'overflow-hidden',
          isSettled && 'circle-float',
        )}
        style={{
          background: 'rgba(20, 22, 50, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(90, 100, 180, 0.45)',
          boxShadow:
            '0 0 80px rgba(167,139,250,0.08), 0 15px 50px rgba(0,0,0,0.4), inset 0 0 50px rgba(255,255,255,0.02)',
          transform: `translate(-50%, -50%) scale(${transform.scale})`,
        }}
      >
        <div
          className="w-full h-full flex items-center justify-center p-[clamp(2rem,4vw,3rem)]"
          style={{
            opacity: transform.contentOpacity,
            transition: isSettled ? 'opacity 0.35s ease-out' : 'none',
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
};

/** Dispatch to the correct content component based on entry type. */
function renderContent(entry: CircleEntry): React.ReactNode {
  switch (entry.type) {
    case 'about':
      return <AboutContent data={entry.data as Personality} />;
    case 'experience':
      return <ExperienceContent data={entry.data as Experience} />;
    case 'project':
      return <ProjectContent data={entry.data as Project} />;
    case 'skillCategory':
      return <SkillCategoryContent data={entry.data as SkillCategory} />;
    case 'education':
      return <EducationContent data={entry.data as Education} />;
    case 'course':
      return <CourseContent data={entry.data as Course} />;
    case 'certificate':
      return <CertificateContent data={entry.data as Certificate} />;
    case 'contact':
      return <ContactContent data={entry.data as ContactInfo} />;
    default:
      return null;
  }
}
