/**
 * Tiny, dependency-free Markdown rendering for journal notes (spec §8.2 #4:
 * "simple Markdown textarea with preview — do not add a heavy editor").
 *
 * Security model: HTML is ESCAPED first — every tag the user types becomes
 * visible text — then a tiny safe subset is re-introduced:
 *   # / ## / ### headings, - bullet lists, **bold**, *italic*, `code`,
 *   [label](https://…) links (http/https only), blank-line paragraphs.
 */

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2">$1</a>',
    );
}

export interface RenderedNote {
  html: string;
  /** Character count of the raw note, for the editor footer. */
  length: number;
}

export function renderJournalNote(note: string | null | undefined): RenderedNote {
  const raw = note ?? "";
  const escaped = escapeHtml(raw);
  const blocks: string[] = [];
  let listBuffer: string[] = [];

  const flushList = (): void => {
    if (listBuffer.length > 0) {
      blocks.push(
        `<ul class="my-2 list-disc space-y-1 pl-5">${listBuffer.map((i) => `<li>${i}</li>`).join("")}</ul>`,
      );
      listBuffer = [];
    }
  };

  for (const rawLine of escaped.split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (bullet) {
      listBuffer.push(renderInline(bullet[1]));
      continue;
    }
    flushList();
    if (line.trim() === "") continue;
    if (heading) {
      const level = heading[1].length;
      const size = level === 1 ? "text-base" : level === 2 ? "text-sm" : "text-xs";
      blocks.push(`<p class="mt-3 ${size} font-semibold">${renderInline(heading[2])}</p>`);
      continue;
    }
    blocks.push(`<p class="my-1.5 leading-relaxed">${renderInline(line)}</p>`);
  }
  flushList();

  return { html: blocks.join(""), length: raw.length };
}
