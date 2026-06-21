import type { Certificate } from '@/types/cv';
import { Keyword, Ident, Punct, ImportType, PropLine, Obj } from './syntax';

export const CertificatesSection = ({ certificates }: { certificates: Certificate[] }) => (
  <div>
    <div>
      <ImportType names={['Certificate']} from="../types" />
    </div>
    <div className="mb-2" />

    <div>
      <Keyword>export const </Keyword>
      <Ident>certificates</Ident><Punct>:</Punct> <Ident>Certificate</Ident><Punct>[]</Punct>
      <Punct> = [</Punct>
    </div>

    {certificates.map((cert, i) => (
      <Obj key={i}>
        <PropLine name="name" value={cert.name} />
        <PropLine name="issuer" value={cert.issuer} />
        <PropLine name="date" value={cert.date} />
        {cert.credentialId && <PropLine name="credentialId" value={cert.credentialId} />}
        {cert.url && <PropLine name="url" value={cert.url} href={cert.url} />}
      </Obj>
    ))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
