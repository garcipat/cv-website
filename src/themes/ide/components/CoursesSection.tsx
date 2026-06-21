import type { Course } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType } from './syntax';

const courseCategory: Record<string, string> = {
  'Advanced React Patterns': 'Frontend',
  'Building Scalable Design Systems': 'Architecture',
  'TypeScript for Professionals': 'Testing',
};

function groupByCategory(courses: Course[]): Map<string, Course[]> {
  const map = new Map<string, Course[]>();
  for (const course of courses) {
    const cat = courseCategory[course.title] ?? 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(course);
  }
  return map;
}

function renderCourseInline(course: Course) {
  return (
    <span>
      <Punct>{'{'}</Punct>
      {' '}<Prop>title</Prop><Punct>:</Punct> <Str>&quot;{course.title}&quot;</Str><Punct>,</Punct>
      {' '}<Prop>provider</Prop><Punct>:</Punct> <Str>&quot;{course.provider}&quot;</Str><Punct>,</Punct>
      {' '}<Prop>date</Prop><Punct>:</Punct> <Str>&quot;{course.date}&quot;</Str>
      {' '}<Punct>{'}'}</Punct>
    </span>
  );
}

const CATEGORIES = ['Frontend', 'Architecture', 'Testing'] as const;

export const CoursesSection = ({ courses }: { courses: Course[] }) => {
  const grouped = groupByCategory(courses);

  return (
    <div>
      <div>
        <ImportType names={['Course']} from="../types" />
      </div>
      <div className="mb-2" />

      <div>
        <Keyword>type </Keyword><Ident>Category</Ident><Punct> = </Punct>
        {CATEGORIES.map((cat, i) => (
          <span key={cat}>
            <Str>&quot;{cat}&quot;</Str>{i < CATEGORIES.length - 1 && <Punct> | </Punct>}
          </span>
        ))}
        <Punct>;</Punct>
      </div>

      <div className="mt-3">
        <Keyword>function </Keyword><Ident>getCourses</Ident><Punct>(</Punct>
        <Prop>category</Prop><Punct>:</Punct> <Ident>Category</Ident>
        <Punct>)</Punct><Punct>:</Punct> <Ident>Course</Ident><Punct>[] </Punct>
        <Punct>{'{'}</Punct>
      </div>

      <div className="ml-2">
        <Keyword>const </Keyword><Ident>catalog</Ident><Punct> = {'{'}</Punct>
      </div>

      {CATEGORIES.map((cat) => {
        const catCourses = grouped.get(cat) ?? [];
        return (
          <div key={cat}>
            <div className="ml-4">
              <Prop>{cat}</Prop><Punct>:</Punct> <Punct>[</Punct>
            </div>
            {catCourses.map((course, j) => (
              <div key={j} className="ml-8">
                {renderCourseInline(course)}<Punct>,</Punct>
              </div>
            ))}
            <div className="ml-4"><Punct>]</Punct><Punct>,</Punct></div>
          </div>
        );
      })}

      <div className="ml-2"><Punct>{'}'}</Punct><Punct>;</Punct></div>

      <div className="ml-2">
        <Keyword>return </Keyword><Ident>catalog</Ident><Punct>[</Punct>category<Punct>]</Punct><Punct>;</Punct>
      </div>

      <div><Punct>{'}'}</Punct></div>
    </div>
  );
};
