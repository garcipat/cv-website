import { useSignals } from '@preact/signals-react/runtime';
import { activeFile, openTabs } from '@/state/ide';
import { currentCV, currentUI } from '@/state/locale';
import type { CVData } from '@/types/cv';
import { AboutSection } from './AboutSection';
import { ExperienceSection } from './ExperienceSection';
import { SkillsSection } from './SkillsSection';
import { ProjectsSection } from './ProjectsSection';
import { EducationSection } from './EducationSection';
import { CoursesSection } from './CoursesSection';
import { CertificatesSection } from './CertificatesSection';
import { TypesSection } from './TypesSection';
import { ReadmeSection } from './ReadmeSection';
import { TimelineSection } from './TimelineSection';

function renderEmptyState(ui: typeof currentUI.value) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[var(--color-ctp-subtext)]">
      <p className="text-sm">{ui.ide.noFileOpen}</p>
      <p className="text-xs mt-1 opacity-60">{ui.ide.selectFile}</p>
    </div>
  );
}

function renderContent(activeFileName: string, cv: CVData): React.ReactNode {
  switch (activeFileName) {
    case 'about.tsx':
      return <AboutSection personality={cv.personality} contact={cv.contact} />;
    case 'experience.tsx':
      return <ExperienceSection experience={cv.experience} />;
    case 'skills.md':
      return <SkillsSection skills={cv.skills} />;
    case 'projects.tsx':
      return <ProjectsSection projects={cv.projects} />;
    case 'education.tsx':
      return <EducationSection education={cv.education} />;
    case 'courses.tsx':
      return <CoursesSection courses={cv.courses} />;
    case 'certificates.tsx':
      return <CertificatesSection certificates={cv.certificates} />;
    case 'timeline.html':
      return <TimelineSection />;
    case 'types.tsx':
      return <TypesSection />;
    case 'README.md':
      return <ReadmeSection />;
    default:
      return <div className="text-[var(--color-ctp-subtext)]">Unknown file: {activeFileName}</div>;
  }
}

export const EditorPane = () => {
  useSignals();

  if (!activeFile.value || openTabs.value.length === 0) {
    return renderEmptyState(currentUI.value);
  }

  const cv = currentCV.value;

  return (
    <div className="overflow-y-auto p-4 text-sm leading-relaxed h-full">
      {renderContent(activeFile.value, cv)}
    </div>
  );
};
