import katex from 'katex';
import { useMemo } from 'react';

/**
 * Renders text containing LaTeX: $inline$ and $$display$$.
 * Questions and solutions are authored this way in the exam builder.
 */
export default function MathText({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
    return parts
      .map((p) => {
        const display = p.startsWith('$$') && p.endsWith('$$') && p.length > 4;
        const inline = !display && p.startsWith('$') && p.endsWith('$') && p.length > 2;
        if (!display && !inline) return esc(p);
        const tex = display ? p.slice(2, -2) : p.slice(1, -1);
        try {
          return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' });
        } catch {
          return esc(p);
        }
      })
      .join('');
  }, [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
