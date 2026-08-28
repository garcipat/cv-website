import { screen } from '@testing-library/react';

export const fileTreePage = {
  get resumeFolder() {
    return screen.getByTestId('file-tree-item-resume');
  },
  get srcFolder() {
    return screen.getByTestId('file-tree-item-src');
  },
  get sectionsFolder() {
    return screen.getByTestId('file-tree-item-src/sections');
  },
  get aboutFile() {
    return screen.getByTestId('file-tree-item-about.tsx');
  },
  get experienceFile() {
    return screen.getByTestId('file-tree-item-experience.tsx');
  },
  get skillsFile() {
    return screen.getByTestId('file-tree-item-skills.md');
  },
  get projectsFile() {
    return screen.getByTestId('file-tree-item-projects.tsx');
  },
  get educationFile() {
    return screen.getByTestId('file-tree-item-education.tsx');
  },
  get coursesFile() {
    return screen.getByTestId('file-tree-item-courses.tsx');
  },
  get certificatesFile() {
    return screen.getByTestId('file-tree-item-certificates.tsx');
  },
  get timelineFile() {
    return screen.getByTestId('file-tree-item-timeline.html');
  },
  get typesFile() {
    return screen.getByTestId('file-tree-item-types.tsx');
  },
  get readmeFile() {
    return screen.getByTestId('file-tree-item-README.md');
  },
};
