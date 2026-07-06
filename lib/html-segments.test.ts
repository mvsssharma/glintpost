import { describe, it, expect } from "vitest";
import {
  extractBlocks,
  reassembleBlocks,
  htmlToText,
  type Block,
  type OutBlock,
} from "./html-segments";

/** Echo transform: return each block unchanged. */
function identity(blocks: Block[]): OutBlock[] {
  return blocks.map((b) => ({ ...b }));
}

const FIXTURE = `<h2>Old Heading</h2>
<p>We shipped a feature for our <a href="https://example.com/docs">customer</a> today, with <strong>bold news</strong>.</p>
<blockquote>A quote about customer value.</blockquote>
<ul>
  <li>First bullet with a <a href="https://example.com/a">link</a></li>
  <li>Second bullet</li>
  <li>Third bullet</li>
</ul>
<ol>
  <li>Step one</li>
  <li>Step two</li>
</ol>
<p><img src="https://cdn.example.com/x.png" alt="a screenshot"></p>
<pre><code>const x = 1 &lt; 2;</code></pre>`;

describe("extractBlocks", () => {
  it("produces ordered blocks and tokenizes links, media, formatting and code", () => {
    const { blocks } = extractBlocks(FIXTURE);

    const heading = blocks.find((b) => b.type === "h");
    expect(heading && "text" in heading && heading.text).toBe("Old Heading");

    // paragraph has a link token (⟦L⟧) and a formatting token (⟦F⟧), never a raw href
    const para = blocks.find((b) => b.type === "p" && "text" in b && /⟦L\d+⟧/.test(b.text));
    expect(para && "text" in para && para.text).toMatch(/⟦L\d+⟧/);
    expect(para && "text" in para && para.text).toMatch(/⟦F\d+⟧/);
    expect(JSON.stringify(blocks)).not.toContain("https://example.com/docs");

    // two lists preserved, ul item carries a link token
    const ul = blocks.find((b) => b.type === "ul");
    const ol = blocks.find((b) => b.type === "ol");
    expect(ul && "items" in ul && ul.items).toHaveLength(3);
    expect(ol && "items" in ol && ol.items).toHaveLength(2);
    expect(ul && "items" in ul && ul.items[0]).toMatch(/⟦L\d+⟧/);

    // media becomes its own block via a token; the code block is opaque
    const media = blocks.find((b) => b.type === "p" && "text" in b && /^⟦M\d+⟧$/.test(b.text));
    expect(media).toBeTruthy();
    const raw = blocks.find((b) => b.type === "raw");
    expect(raw && "token" in raw && raw.token).toMatch(/⟦B\d+⟧/);

    // code text never reaches the model
    expect(JSON.stringify(blocks)).not.toContain("const x");
  });
});

describe("reassembleBlocks", () => {
  it("identity round-trip keeps media/links/code byte-identical", () => {
    const { blocks, ctx } = extractBlocks(FIXTURE);
    const out = reassembleBlocks(ctx, identity(blocks));
    expect(out).toContain('href="https://example.com/docs"');
    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain('src="https://cdn.example.com/x.png"');
    expect(out).toContain("<strong>bold news</strong>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<ol>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("const x = 1"); // code block restored
  });

  it("preserves Quill video embeds (<iframe>) which default sanitizers strip", () => {
    const html = `<p>Watch this:</p><p><iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/abc123"></iframe></p>`;
    const { blocks, ctx } = extractBlocks(html);
    // The iframe is tokenized as media, not dropped.
    const mediaBlock = blocks.find((b) => b.type === "p" && "text" in b && /^⟦M\d+⟧$/.test(b.text)) as { text: string };
    expect(mediaBlock).toBeTruthy();
    const out = reassembleBlocks(ctx, blocks.map((b) => ({ ...b })));
    expect(out).toContain("<iframe");
    expect(out).toContain('src="https://www.youtube.com/embed/abc123"');
  });

  it("allows holistic restructure — merge paragraphs, keep the link token", () => {
    const { blocks, ctx } = extractBlocks(FIXTURE);
    // Derive the real token ids (assigned by a global counter in extraction order).
    const intro = blocks.find(
      (b) => b.type === "p" && "text" in b && /⟦L\d+⟧/.test(b.text),
    ) as { text: string };
    const introLink = intro.text.match(/⟦L\d+⟧/)![0];
    const fmtTok = intro.text.match(/⟦F\d+⟧/)![0];
    const ul = blocks.find((b) => b.type === "ul") as { items: string[] };
    const ulLink = ul.items.join(" ").match(/⟦L\d+⟧/)![0];
    const mediaTok = (blocks.find(
      (b) => b.type === "p" && "text" in b && /^⟦M\d+⟧$/.test(b.text),
    ) as { text: string }).text;
    const codeTok = (blocks.find((b) => b.type === "raw") as { token: string }).token;

    // Rewrite from scratch: keep every token exactly once, restructure freely.
    const rewritten: OutBlock[] = [
      { type: "h", level: 2, text: "Fresh Heading" },
      { type: "p", text: `Rewritten intro linking ${introLink} with ${fmtTok}.` },
      { type: "quote", text: "A quote about customer value." },
      { type: "ul", items: [`Merged first and second ${ulLink}`, "Third bullet"] },
      { type: "ol", items: ["Step one", "Step two"] },
      { type: "p", text: mediaTok },
      { type: "raw", token: codeTok },
    ];
    const out = reassembleBlocks(ctx, rewritten);
    expect(out).toContain("Fresh Heading");
    expect(out).toContain('href="https://example.com/docs"');
    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain("<strong>bold news</strong>");
    // ul now has 2 items instead of 3
    expect((out.match(/<li>/g) ?? []).length).toBe(2 + 2);
  });
});

describe("terminology visibility through tokens", () => {
  it("keeps link/bold text in the reassembled plain text (so checkTerms sees it)", () => {
    // "customer" appears ONLY inside a link and a bold span — i.e. inside tokens.
    const html = `<p>Read the <a href="https://x.com/docs">customer</a> guide for every <strong>customer</strong>.</p>`;
    const { blocks, ctx } = extractBlocks(html);
    // In the block payload the term is hidden behind tokens...
    expect(JSON.stringify(blocks)).not.toContain("customer");
    // ...but after reassembly + htmlToText it's visible again, which is what the route's
    // terminology check now runs against (avoiding a false "customer vanished" warning).
    const out = reassembleBlocks(ctx, blocks.map((b) => ({ ...b })));
    expect(htmlToText(out)).toContain("customer");
    expect((htmlToText(out).match(/customer/g) ?? []).length).toBe(2);
  });
});

describe("reassembleBlocks validation", () => {
  it("throws when a token is dropped", () => {
    const { ctx } = extractBlocks(`<p>hi <a href="https://x.com">l</a></p>`);
    expect(() => reassembleBlocks(ctx, [{ type: "p", text: "hi" }])).toThrow();
  });

  it("throws when a token is duplicated", () => {
    const { blocks, ctx } = extractBlocks(`<p>hi <a href="https://x.com">l</a></p>`);
    const tok = (blocks[0] as { text: string }).text.match(/⟦L\d+⟧/)![0];
    expect(() =>
      reassembleBlocks(ctx, [{ type: "p", text: `${tok} ${tok}` }]),
    ).toThrow();
  });

  it("throws when a block smuggles raw markup", () => {
    const { ctx } = extractBlocks(`<p>hello</p>`);
    expect(() =>
      reassembleBlocks(ctx, [{ type: "p", text: "<script>x</script>" }]),
    ).toThrow();
  });

  it("throws on an unknown token", () => {
    const { ctx } = extractBlocks(`<p>hello</p>`);
    expect(() =>
      reassembleBlocks(ctx, [{ type: "p", text: "hello ⟦M9⟧" }]),
    ).toThrow();
  });
});

describe("htmlToText", () => {
  it("strips tags", () => {
    expect(htmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
});
