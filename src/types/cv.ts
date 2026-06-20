// ---------------------------------------------------------------------------
// CV Data Model — TypeScript interfaces for all CV content sections
//
// All dates use YYYY-MM string format (e.g. "2021-04").
// Skill levels are 0–100 integer scale (0 = none, 100 = expert).
// Arrays default to [] when entries are absent — always safe to iterate.
// ---------------------------------------------------------------------------

/** Contact details for the CV owner. All fields are optional. */
export interface ContactInfo {
  /** Email address, e.g. "jane@example.com" */
  email?: string;
  /** Phone number, e.g. "+49 123 456789" */
  phone?: string;
  /** City/region, e.g. "Berlin, Germany" */
  location?: string;
  /** Personal website URL, e.g. "https://jane.dev" */
  website?: string;
  /** LinkedIn profile URL or handle */
  linkedin?: string;
  /** GitHub profile URL or handle */
  github?: string;
}

/** The CV owner's identity and professional introduction. */
export interface Personality {
  /** Full name, e.g. "Jane Developer" */
  name: string;
  /** Short professional tagline, e.g. "Senior Frontend Developer" */
  tagline: string;
  /** Multi-paragraph career summary (plain text, may contain newlines) */
  summary: string;
  /** A personal motto or favourite quote */
  favoriteQuote?: string;
}

/** A career timeline entry representing one job or professional engagement. */
export interface Experience {
  /** Company or organization name, e.g. "Tech Innovations Inc." */
  company: string;
  /** Job title, e.g. "Staff Frontend Engineer" */
  role: string;
  /** Start date in YYYY-MM format, e.g. "2021-04" */
  startDate: string;
  /** End date in YYYY-MM format. Omit for current positions (rendered as "Present"). */
  endDate?: string;
  /** Key achievements or responsibilities as bullet-point strings. Minimum 1 entry. */
  highlights: string[];
  /** Optional work location, e.g. "Berlin, Germany" or "Remote" */
  location?: string;
}

/** A named group of related skills. */
export interface SkillCategory {
  /** Category name, e.g. "Frontend", "Backend", "DevOps" */
  category: string;
  /** Skills within this category. Minimum 1 entry recommended. */
  skills: Skill[];
}

/** An individual skill with proficiency level. */
export interface Skill {
  /** Skill name, e.g. "React", "TypeScript", "Docker" */
  name: string;
  /** Proficiency level on a 0–100 integer scale (0 = none, 100 = expert) */
  level: number;
}

/** A completed training course or certification program. */
export interface Course {
  /** Course or program title, e.g. "Advanced React Patterns" */
  title: string;
  /** Organization providing the course, e.g. "Frontend Masters" */
  provider: string;
  /** Year of completion, e.g. 2024 */
  year: number;
  /** Optional certificate URL or identifier */
  certificate?: string;
}

/** A formal education entry (university degree, diploma, etc.). */
export interface Education {
  /** Degree name, e.g. "B.Sc. Computer Science" */
  degree: string;
  /** Educational institution, e.g. "Technical University Berlin" */
  institution: string;
  /** Start date in YYYY-MM format, e.g. "2016-10" */
  startDate: string;
  /** End date in YYYY-MM format. Omit for ongoing studies. */
  endDate?: string;
  /** Optional description, e.g. thesis topic, honours, or activities */
  description?: string;
}

/** An earned professional certification. */
export interface Certificate {
  /** Certificate name, e.g. "AWS Solutions Architect Associate" */
  name: string;
  /** Issuing organization, e.g. "Amazon Web Services" */
  issuer: string;
  /** Date awarded in YYYY-MM format, e.g. "2023-06" */
  date: string;
  /** Optional verification URL for the certificate */
  url?: string;
  /** Optional credential identifier, e.g. "AWS-ASA-12345" */
  credentialId?: string;
}

/** A personal or professional project showcased in the CV. */
export interface Project {
  /** Project name, e.g. "Open Source Task Runner" */
  name: string;
  /** Project description (plain text, may be multi-sentence) */
  description: string;
  /** Technologies used, e.g. ["React", "Node.js", "PostgreSQL"] */
  techStack: string[];
  /** Optional live project URL */
  url?: string;
  /** Optional source code repository URL */
  githubUrl?: string;
  /** Optional screenshot or preview image URL */
  imageUrl?: string;
}

/**
 * Root type for all CV content. Contains every section as a typed property.
 * Imported by the locale signal and consumed by all theme layout components.
 */
export interface CVData {
  /** The CV owner's identity and professional introduction */
  personality: Personality;
  /** Optional contact details (independent top-level field, separate from personality) */
  contact?: ContactInfo;
  /** Career timeline entries, newest first */
  experience: Experience[];
  /** Grouped skills by category */
  skills: SkillCategory[];
  /** Completed training courses and programs */
  courses: Course[];
  /** Formal education history */
  education: Education[];
  /** Professional certifications */
  certificates: Certificate[];
  /** Personal or professional projects */
  projects: Project[];
}
