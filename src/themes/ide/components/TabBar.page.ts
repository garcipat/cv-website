import { screen } from '@testing-library/react';

const tab = (fileName: string) => ({
  get tab() {
    return screen.getByTestId(`tab-item-${fileName}`);
  },
  get closeButton() {
    return screen.getByTestId(`tab-close-${fileName}`);
  },
});

export const tabBarPage = {
  get allTabs() {
    return screen.getAllByTestId(/^tab-item-/);
  },
  about: tab('about.tsx'),
  experience: tab('experience.tsx'),
  skills: tab('skills.md'),
  projects: tab('projects.tsx'),
  education: tab('education.tsx'),
  courses: tab('courses.tsx'),
  certificates: tab('certificates.tsx'),
  timeline: tab('timeline.html'),
  types: tab('types.tsx'),
  readme: tab('README.md'),
};
