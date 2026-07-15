import { Schema, NodeSpec, MarkSpec, DOMOutputSpec } from 'prosemirror-model';
import { sanitizeHref } from './sanitize';

/**
 * Node specifications matching our document model
 */
const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'block+',
  },

  paragraph: {
    content: 'inline*',
    group: 'block',
    attrs: {
      alignment: { default: 'left' },
      indent: { default: 0 },
      lineSpacing: { default: 'single' },
      spaceBefore: { default: 0 },
      spaceAfter: { default: 8 },
    },
    parseDOM: [{ tag: 'p' }],
    toDOM(node): DOMOutputSpec {
      const style = `text-align: ${node.attrs.alignment}; margin-top: ${node.attrs.spaceBefore}px; margin-bottom: ${node.attrs.spaceAfter}px;`;
      return ['p', { style }, 0];
    },
  },

  heading: {
    content: 'inline*',
    group: 'block',
    attrs: {
      level: { default: 1 },
      alignment: { default: 'left' },
    },
    parseDOM: [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } },
    ],
    toDOM(node): DOMOutputSpec {
      return [`h${node.attrs.level}`, { style: `text-align: ${node.attrs.alignment}` }, 0];
    },
  },

  bullet_list: {
    content: 'list_item+',
    group: 'block',
    parseDOM: [{ tag: 'ul' }],
    toDOM(): DOMOutputSpec {
      return ['ul', 0];
    },
  },

  ordered_list: {
    content: 'list_item+',
    group: 'block',
    attrs: { start: { default: 1 } },
    parseDOM: [
      {
        tag: 'ol',
        getAttrs(dom: HTMLElement) {
          return { start: dom.hasAttribute('start') ? +dom.getAttribute('start')! : 1 };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return node.attrs.start === 1 ? ['ol', 0] : ['ol', { start: node.attrs.start }, 0];
    },
  },

  list_item: {
    content: 'paragraph block*',
    parseDOM: [{ tag: 'li' }],
    toDOM(): DOMOutputSpec {
      return ['li', 0];
    },
    defining: true,
  },

  table: {
    content: 'table_row+',
    group: 'block',
    tableRole: 'table',
    isolating: true,
    parseDOM: [{ tag: 'table' }],
    toDOM(): DOMOutputSpec {
      return ['table', { class: 'docs-table' }, ['tbody', 0]];
    },
  },

  table_row: {
    content: '(table_cell | table_header)+',
    tableRole: 'row',
    parseDOM: [{ tag: 'tr' }],
    toDOM(): DOMOutputSpec {
      return ['tr', 0];
    },
  },

  table_cell: {
    content: 'block+',
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null },
      backgroundColor: { default: null },
    },
    tableRole: 'cell',
    isolating: true,
    parseDOM: [
      {
        tag: 'td',
        getAttrs(dom: HTMLElement) {
          const colspan = dom.getAttribute('colspan');
          const rowspan = dom.getAttribute('rowspan');
          const bgColor = dom.style.backgroundColor || null;
          return {
            colspan: colspan ? +colspan : 1,
            rowspan: rowspan ? +rowspan : 1,
            backgroundColor: bgColor,
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = {};
      if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan;
      if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan;
      if (node.attrs.backgroundColor) attrs.style = `background-color: ${node.attrs.backgroundColor}`;
      return ['td', attrs, 0];
    },
  },

  table_header: {
    content: 'block+',
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null },
      backgroundColor: { default: null },
    },
    tableRole: 'header_cell',
    isolating: true,
    parseDOM: [
      {
        tag: 'th',
        getAttrs(dom: HTMLElement) {
          const colspan = dom.getAttribute('colspan');
          const rowspan = dom.getAttribute('rowspan');
          const bgColor = dom.style.backgroundColor || null;
          return {
            colspan: colspan ? +colspan : 1,
            rowspan: rowspan ? +rowspan : 1,
            backgroundColor: bgColor,
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = {};
      if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan;
      if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan;
      if (node.attrs.backgroundColor) attrs.style = `background-color: ${node.attrs.backgroundColor}`;
      return ['th', attrs, 0];
    },
  },

  image: {
    group: 'block',
    attrs: {
      src: {},
      alt: { default: '' },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      alignment: { default: 'center' },
    },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs(dom: HTMLElement) {
          return {
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt') || '',
            title: dom.getAttribute('title'),
            width: dom.getAttribute('width'),
            height: dom.getAttribute('height'),
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string | null> = {
        src: node.attrs.src,
        alt: node.attrs.alt,
      };
      if (node.attrs.title) attrs.title = node.attrs.title;
      if (node.attrs.width) attrs.width = node.attrs.width;
      if (node.attrs.height) attrs.height = node.attrs.height;
      return ['img', attrs];
    },
  },

  horizontal_rule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM(): DOMOutputSpec {
      return ['hr'];
    },
  },

  page_break: {
    group: 'block',
    parseDOM: [{ tag: 'div.page-break' }],
    toDOM(): DOMOutputSpec {
      return ['div', { class: 'page-break' }];
    },
  },

  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM(): DOMOutputSpec {
      return ['br'];
    },
  },

  text: {
    group: 'inline',
  },
};

/**
 * Mark specifications for inline formatting
 */
const marks: Record<string, MarkSpec> = {
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b' },
      {
        style: 'font-weight',
        getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
      },
    ],
    toDOM(): DOMOutputSpec {
      return ['strong', 0];
    },
  },

  italic: {
    parseDOM: [
      { tag: 'em' },
      { tag: 'i' },
      { style: 'font-style=italic' },
    ],
    toDOM(): DOMOutputSpec {
      return ['em', 0];
    },
  },

  underline: {
    parseDOM: [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: (value: string) => value.includes('underline') && null,
      },
    ],
    toDOM(): DOMOutputSpec {
      return ['u', 0];
    },
  },

  strikethrough: {
    parseDOM: [
      { tag: 's' },
      { tag: 'strike' },
      { tag: 'del' },
      {
        style: 'text-decoration',
        getAttrs: (value: string) => value.includes('line-through') && null,
      },
    ],
    toDOM(): DOMOutputSpec {
      return ['s', 0];
    },
  },

  superscript: {
    excludes: 'subscript',
    parseDOM: [{ tag: 'sup' }],
    toDOM(): DOMOutputSpec {
      return ['sup', 0];
    },
  },

  subscript: {
    excludes: 'superscript',
    parseDOM: [{ tag: 'sub' }],
    toDOM(): DOMOutputSpec {
      return ['sub', 0];
    },
  },

  link: {
    attrs: {
      href: {},
      title: { default: null },
      target: { default: '_blank' },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs(dom: HTMLElement) {
          return {
            href: sanitizeHref(dom.getAttribute('href')),
            title: dom.getAttribute('title'),
            target: dom.getAttribute('target'),
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string | null> = {
        href: sanitizeHref(node.attrs.href as string | null),
        rel: 'noopener noreferrer',
      };
      if (node.attrs.title) attrs.title = node.attrs.title;
      if (node.attrs.target) attrs.target = node.attrs.target;
      return ['a', attrs, 0];
    },
  },

  textStyle: {
    attrs: {
      color: { default: null },
      backgroundColor: { default: null },
      fontSize: { default: null },
      fontFamily: { default: null },
    },
    parseDOM: [
      {
        tag: 'span',
        getAttrs(dom: HTMLElement) {
          const style = dom.style;
          return {
            color: style.color || null,
            backgroundColor: style.backgroundColor || null,
            fontSize: style.fontSize ? parseInt(style.fontSize) : null,
            fontFamily: style.fontFamily || null,
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const styles: string[] = [];
      if (node.attrs.color) styles.push(`color: ${node.attrs.color}`);
      if (node.attrs.backgroundColor) styles.push(`background-color: ${node.attrs.backgroundColor}`);
      if (node.attrs.fontSize) styles.push(`font-size: ${node.attrs.fontSize}pt`);
      if (node.attrs.fontFamily) styles.push(`font-family: ${node.attrs.fontFamily}`);
      return ['span', { style: styles.join('; ') }, 0];
    },
  },

  smallCaps: {
    parseDOM: [
      {
        style: 'font-variant',
        getAttrs: (value: string) => value === 'small-caps' && null,
      },
    ],
    toDOM(): DOMOutputSpec {
      return ['span', { style: 'font-variant: small-caps' }, 0];
    },
  },

  // Anchors a comment thread to a span of text. `threadId` points at an
  // entry in the document's comment-thread store. `inclusive: false` so
  // typing at either edge of the range does not extend the comment.
  comment: {
    attrs: {
      threadId: {},
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'span[data-comment-thread]',
        getAttrs(dom: HTMLElement) {
          return { threadId: dom.getAttribute('data-comment-thread') };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return ['span', { 'data-comment-thread': node.attrs.threadId as string }, 0];
    },
  },
};

/**
 * The main ProseMirror schema for the docs editor
 */
export const docsSchema = new Schema({ nodes, marks });

/**
 * Export individual node and mark specs for extension
 */
export { nodes as nodeSpecs, marks as markSpecs };

