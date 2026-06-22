import { Keyword, Ident, Prop, Str, Punct, LineComment } from './syntax';

function Interface({ name, props }: { name: string; props: { name: string; type: string; optional?: boolean }[] }) {
  return (
    <div className="mb-4">
      <div>
        <Keyword>interface </Keyword>
        <Ident>{name}</Ident>
        <Punct> {'{'}</Punct>
      </div>
      {props.map((p) => (
        <div key={p.name} className="ml-6">
          <Prop>{p.name}</Prop>
          {p.optional && <Punct>?</Punct>}
          <Punct>:</Punct>
          {' '}
          {p.type.startsWith('"') ? <Str>{p.type}</Str> : <Ident>{p.type}</Ident>}
          <Punct>;</Punct>
        </div>
      ))}
      <div><Punct>{'}'}</Punct></div>
    </div>
  );
}

export const TypesSection = () => (
  <div>
    <div className="mb-3">
      <LineComment>// Type definitions for resume data model</LineComment>
    </div>

    <Interface
      name="Skill"
      props={[
        { name: 'name', type: 'string' },
        { name: 'level', type: 'number' },
      ]}
    />

    <Interface
      name="ContactInfo"
      props={[
        { name: 'email', type: 'string', optional: true },
        { name: 'phone', type: 'string', optional: true },
        { name: 'location', type: 'string', optional: true },
        { name: 'website', type: 'string', optional: true },
        { name: 'github', type: 'string', optional: true },
      ]}
    />

    <Interface
      name="Personality"
      props={[
        { name: 'name', type: 'string' },
        { name: 'tagline', type: 'string' },
        { name: 'summary', type: 'string' },
        { name: 'favoriteQuote', type: 'string', optional: true },
      ]}
    />

    <Interface
      name="Experience"
      props={[
        { name: 'company', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'startDate', type: 'string' },
        { name: 'endDate', type: 'string', optional: true },
        { name: 'location', type: 'string', optional: true },
        { name: 'highlights', type: 'string[]' },
        { name: 'skills', type: 'Skill[]', optional: true },
      ]}
    />

    <Interface
      name="Project"
      props={[
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'skills', type: 'Skill[]', optional: true },
        { name: 'url', type: 'string', optional: true },
        { name: 'githubUrl', type: 'string', optional: true },
      ]}
    />

    <Interface
      name="Education"
      props={[
        { name: 'degree', type: 'string' },
        { name: 'institution', type: 'string' },
        { name: 'startDate', type: 'string' },
        { name: 'endDate', type: 'string', optional: true },
        { name: 'description', type: 'string', optional: true },
      ]}
    />

    <Interface
      name="Course"
      props={[
        { name: 'title', type: 'string' },
        { name: 'provider', type: 'string' },
        { name: 'date', type: 'string' },
        { name: 'certificate', type: 'string', optional: true },
      ]}
    />

    <Interface
      name="Certificate"
      props={[
        { name: 'name', type: 'string' },
        { name: 'issuer', type: 'string' },
        { name: 'date', type: 'string' },
        { name: 'url', type: 'string', optional: true },
        { name: 'credentialId', type: 'string', optional: true },
      ]}
    />
  </div>
);
