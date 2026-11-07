import { describe, expect, it } from "vitest";

import { renderJournalNote } from "@/lib/journal-markdown";

describe("renderJournalNote", () => {
  it("escapes raw HTML instead of executing it", () => {
    const { html } = renderJournalNote("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders bold, italic and inline code", () => {
    const { html } = renderJournalNote("**clean** *break* `S:ICT-OB`");
    expect(html).toContain("<strong>clean</strong>");
    expect(html).toContain("<em>break</em>");
    expect(html).toContain("<code");
  });

  it("links only http(s) targets with rel safety", () => {
    const { html } = renderJournalNote(
      "[charts](https://example.com/x) and [bad](javascript:alert(1))",
    );
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain("noopener");
    // The javascript: scheme is never turned into an anchor — it stays text.
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("[bad](javascript:alert(1))");
  });

  it("renders heading sizes and bullet lists", () => {
    const { html } = renderJournalNote("## Setup\n- grabbed OB\n- HTF aligned");
    expect(html).toContain("font-semibold");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>grabbed OB</li>");
  });

  it("keeps multi-line paragraphs and reports the raw length", () => {
    const note = "line one\n\nline two";
    const { html, length } = renderJournalNote(note);
    expect(html).toContain("line one");
    expect(html).toContain("line two");
    expect(length).toBe(note.length);
  });

  it("renders nothing for null/empty notes", () => {
    expect(renderJournalNote(null).html).toBe("");
    expect(renderJournalNote("").html).toBe("");
  });
});
