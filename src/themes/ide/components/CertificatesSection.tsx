import type { Certificate } from '@/types/cv';

export const CertificatesSection = ({ certificates }: { certificates: Certificate[] }) => (
  <>
    {certificates.map((cert, i) => (
      <div key={i} className="mb-3">
        <div>
          <span className="text-[var(--ide-label-color)]">certificate: </span>
          <span className="text-[var(--ide-value-color)]">{cert.name}</span>
        </div>
        <div className="text-sm">
          <span className="text-[var(--ide-label-color)]">issuer: </span>
          <span className="text-[var(--ide-value-color)]">{cert.issuer}</span>
          <span className="text-[var(--ide-date-color)]"> ({cert.date})</span>
        </div>
        {cert.credentialId && (
          <div className="text-sm">
            <span className="text-[var(--ide-date-color)]">credential: </span>
            <span className="text-[var(--ide-value-color)]">{cert.credentialId}</span>
          </div>
        )}
        {cert.url && (
          <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--ide-link-color)] hover:underline">
            {cert.url}
          </a>
        )}
      </div>
    ))}
  </>
);
