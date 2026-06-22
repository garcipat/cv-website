import type { CertificateBatch } from '../../parade-utils';
import type { Certificate } from '@/types/cv';

export interface CertificateContentProps {
  data: CertificateBatch;
}

function fmtDate(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function CertEntry({ cert }: { cert: Certificate }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <h4 className="text-xs font-semibold text-[var(--foreground)] leading-tight text-center">
        {cert.name}
      </h4>
      <p className="text-[10px] text-[var(--primary)]">
        {cert.issuer}
      </p>
      <p className="text-[9px] text-[var(--muted-foreground)]">
        {fmtDate(cert.date)}
      </p>
      {cert.url && (
        <a
          href={cert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-[var(--accent)] hover:underline cursor-pointer"
        >
          Website
        </a>
      )}
    </div>
  );
}

export const CertificateContent = ({ data }: CertificateContentProps) => {
  return (
    <div className="flex flex-col gap-3 px-5 py-3 max-w-md mx-auto w-full">
      <h3 className="text-sm font-semibold text-[var(--primary)] text-center">
        Certificates
      </h3>
      {data.certificates.map((cert, i) => (
        <div key={i}>
          {i > 0 && <div className="border-t border-[var(--border)] my-2 opacity-30" />}
          <CertEntry cert={cert} />
        </div>
      ))}
    </div>
  );
};
