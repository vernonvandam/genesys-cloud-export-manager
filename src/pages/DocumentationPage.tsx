type MarkdownBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

type Guide = {
  id: string;
  title: string;
  content: string;
};

const documentationFiles = import.meta.glob<string>("../../docs/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

const guides: Guide[] = Object.entries(documentationFiles)
  .map(([path, content]) => {
    const fileName = path.split(/[\\/]/).pop() ?? path;
    const id = fileName.replace(/\.md$/i, "");
    const title = content.match(/^#\s+(.+)$/m)?.[1] ?? id;

    return { id, title, content };
  })
  .sort((first, second) => first.title.localeCompare(second.title));

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length) {
      blocks.push({ kind: "list", ordered: listOrdered, items: listItems });
      listItems = [];
    }
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    const listItem = line.match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        text: heading[2],
      });
    } else if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[2]);
      if (listItems.length && ordered !== listOrdered) flushList();
      if (!listItems.length) listOrdered = ordered;
      listItems.push(listItem[3]);
    } else if (listItems.length && /^\s+\S/.test(line)) {
      listItems[listItems.length - 1] += ` ${line.trim()}`;
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (!line.startsWith("# ")) {
      flushList();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderGuideContent(content: string) {
  const markdownWithoutTitle = content.replace(/^#\s+.+(?:\r?\n|$)/m, "");

  return parseMarkdown(markdownWithoutTitle).map((block, index) => {
    if (block.kind === "heading") {
      return block.level === 2 ? (
        <h3 key={index}>{block.text}</h3>
      ) : (
        <h4 key={index}>{block.text}</h4>
      );
    }

    if (block.kind === "paragraph") {
      return <p key={index}>{block.text}</p>;
    }

    const List = block.ordered ? "ol" : "ul";
    return (
      <List key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>{item}</li>
        ))}
      </List>
    );
  });
}

export default function DocumentationPage() {
  return (
    <div className="workspace-view documentation-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">Documentation</h2>
          <p className="page-description">
            Guides to signing in, managing access, and using the export
            workspace.
          </p>
        </div>
      </div>

      <nav className="documentation-index" aria-label="Documentation guides">
        {guides.map((guide) => (
          <a key={guide.id} href={`#${guide.id}`}>
            {guide.title}
          </a>
        ))}
      </nav>

      <div className="documentation-guides">
        {guides.map((guide) => (
          <article
            className="documentation-article"
            id={guide.id}
            key={guide.id}
          >
            <h2>{guide.title}</h2>
            <div className="documentation-markdown">
              {renderGuideContent(guide.content)}
            </div>
          </article>
        ))}
        {guides.length === 0 && (
          <p>No guides are available yet.</p>
        )}
      </div>
    </div>
  );
}
