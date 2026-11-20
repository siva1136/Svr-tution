import EnquiryForm from '../components/EnquiryForm';
import Icon from '../components/Icon';
import { PageHero } from '../components/Section';
import { useSettings, whatsappLink } from '../lib/data';
import { useSeo } from '../lib/seo';

export default function Contact() {
  useSeo('Contact', 'Contact SVR Maths Academy — phone, WhatsApp, email and address.');
  const { data: s } = useSettings();
  return (
    <>
      <PageHero eyebrow="Contact" title="We'd love to hear from you" />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          {[
            { icon: 'phone', label: 'Call us', value: s.phone, href: `tel:${s.phone.replace(/\s/g, '')}` },
            { icon: 'mail', label: 'Email', value: s.email, href: `mailto:${s.email}` },
            { icon: 'pin', label: 'Visit', value: s.address, href: s.mapUrl },
          ].map((c) => (
            <a key={c.label} href={c.href} className="card flex gap-4 p-5" target={c.icon === 'pin' ? '_blank' : undefined} rel="noopener noreferrer">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-royal-100 text-royal-600"><Icon name={c.icon} /></div>
              <div>
                <p className="text-xs text-ink-900/50">{c.label}</p>
                <p className="font-medium break-words">{c.value}</p>
              </div>
            </a>
          ))}
          <a href={whatsappLink(s.whatsapp, 'Hello SVR Maths Academy!')} target="_blank" rel="noopener noreferrer" className="btn w-full bg-[#25D366] py-3 text-white hover:brightness-95">
            Chat on WhatsApp
          </a>
        </div>
        <EnquiryForm type="contact" submitLabel="Send message" />
      </section>
    </>
  );
}
