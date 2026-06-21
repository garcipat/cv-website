import type { Certificate } from '@/types/cv';
import { Keyword, Ident, Prop, Str, Punct, ImportType } from './syntax';

function q(s: string) {
  return <Str>&quot;{s}&quot;</Str>;
}

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
      <div key={i}>
        <div className="ml-2"><Punct>{'{'}</Punct></div>

        <div className="ml-6">
          <Prop>name</Prop><Punct>:</Punct> {q(cert.name)}<Punct>,</Punct>
        </div>
        <div className="ml-6">
          <Prop>issuer</Prop><Punct>:</Punct> {q(cert.issuer)}<Punct>,</Punct>
        </div>
        <div className="ml-6">
          <Prop>date</Prop><Punct>:</Punct> {q(cert.date)}<Punct>,</Punct>
        </div>
        {cert.credentialId && (
          <div className="ml-6">
            <Prop>credentialId</Prop><Punct>:</Punct> {q(cert.credentialId)}<Punct>,</Punct>
          </div>
        )}
        {cert.url && (
          <div className="ml-6">
            <Prop>url</Prop><Punct>:</Punct> {q(cert.url)}<Punct>,</Punct>
          </div>
        )}

        <div className="ml-2"><Punct>{'}'}</Punct><Punct>,</Punct></div>
      </div>
    ))}

    <div><Punct>]</Punct><Punct>;</Punct></div>
  </div>
);
