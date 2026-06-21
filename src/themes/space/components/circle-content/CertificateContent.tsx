import type { Certificate } from '@/types/cv';

export interface CertificateContentProps {
  data: Certificate;
}

function fmtDate(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export const CertificateContent = ({ data }: CertificateContentProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 max-w-sm mx-auto text-center">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {data.name}
      </h3>
      <p className="text-xs text-[var(--primary)]">
        {data.issuer}
      </p>
      <p className="text-[10px] text-[var(--muted-foreground)]">
        {fmtDate(data.date)}
      </p>
      {data.credentialId && (
        <p className="text-[9px] text-[var(--muted-foreground)] font-mono">
          ID: {data.credentialId}
        </p>
      )}
      {data.url && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[var(--accent)] hover:underline mt-1"
        >
          Verify Credential
        </a>
      )}
    </div>
  );
};
