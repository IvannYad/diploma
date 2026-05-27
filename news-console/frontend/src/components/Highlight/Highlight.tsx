import './Highlight.scss';

interface Props {
  text: string;
  term: string;
}

export default function Highlight({ text, term }: Props) {
  if (!term.trim()) return <>{text}</>;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="highlight">{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
