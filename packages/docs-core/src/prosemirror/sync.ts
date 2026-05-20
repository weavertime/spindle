import { Node as PmNode, type Mark } from 'prosemirror-model';
import { docsSchema } from './schema';
import type {
  Document,
  Block,
  Section,
  InlineContent,
  TextRun,
  InlineLink,
  TextStyle,
  TextStylePool,
  ParagraphBlock,
  HeadingBlock,
  TableRow,
  TableCell,
  ListType,
} from '../types';

/**
 * Loosely-typed ProseMirror node JSON — the shape Schema.nodeFromJSON()
 * accepts. ProseMirror itself types this position as `any`.
 */
export interface PmNodeJSON {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNodeJSON[];
  marks?: PmMarkJSON[];
  text?: string;
  /**
   * Internal marker field, set only on synthetic '__list_item__' nodes.
   * blocksToPmDoc groups consecutive markers into list nodes — the markers
   * themselves are never handed to ProseMirror.
   */
  listType?: ListType;
}

/** Loosely-typed ProseMirror mark JSON. */
export interface PmMarkJSON {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * Convert our document model to ProseMirror JSON format
 */
export function documentToProseMirror(doc: Document): PmNodeJSON {
  const content = doc.sections
    .flatMap(section => section.blocks.map(block => blockToPmNode(block)))
    .filter((node): node is PmNodeJSON => node !== null);

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  };
}

/**
 * Convert a section to ProseMirror JSON format
 */
export function sectionToProseMirror(section: Section): PmNodeJSON {
  const content = section.blocks
    .map(block => blockToPmNode(block))
    .filter((node): node is PmNodeJSON => node !== null);

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  };
}

/**
 * Convert a single block to ProseMirror node JSON
 */
function blockToPmNode(block: Block, stylePool?: TextStylePool): PmNodeJSON | null {
  switch (block.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        attrs: {
          alignment: block.alignment || 'left',
          indent: block.indent || 0,
          lineSpacing: 'single',
          spaceBefore: block.spaceBefore || 0,
          spaceAfter: block.spaceAfter ?? 8,
        },
        content: inlineContentToPm(block.content, stylePool),
      };
      
    case 'heading':
      return {
        type: 'heading',
        attrs: { 
          level: block.level,
          alignment: block.alignment || 'left',
        },
        content: inlineContentToPm(block.content, stylePool),
      };
      
    case 'list-item':
      // Return just the list_item node - grouping into lists is handled by blocksToPmDoc
      return {
        type: '__list_item__',  // Special marker - will be grouped into lists by blocksToPmDoc
        listType: block.listType,
        content: [{
          type: 'list_item',
          content: [{
            type: 'paragraph',
            content: inlineContentToPm(block.content, stylePool),
          }],
        }],
      };
      
    case 'table':
      return {
        type: 'table',
        content: block.rows.map(row => ({
          type: 'table_row',
          content: row.cells.map(cell => ({
            type: 'table_cell',
            attrs: {
              colspan: cell.colspan || 1,
              rowspan: cell.rowspan || 1,
            },
            content: [{
              type: 'paragraph',
              content: inlineContentToPm(cell.content, stylePool),
            }],
          })),
        })),
      };
      
    case 'image':
      return {
        type: 'image',
        attrs: {
          src: block.src,
          alt: block.alt || '',
          width: block.width,
          height: block.height,
          alignment: block.alignment || 'center',
        },
      };
      
    case 'horizontal-rule':
      return { type: 'horizontal_rule' };
      
    case 'page-break':
      return { type: 'page_break' };
      
    default:
      return null;
  }
}

/**
 * Convert a TextStyle to ProseMirror marks
 */
function styleToMarks(style: TextStyle): PmMarkJSON[] {
  const marks: PmMarkJSON[] = [];
  
  if (style.bold) marks.push({ type: 'bold' });
  if (style.italic) marks.push({ type: 'italic' });
  if (style.underline) marks.push({ type: 'underline' });
  if (style.strikethrough) marks.push({ type: 'strikethrough' });
  if (style.superscript) marks.push({ type: 'superscript' });
  if (style.subscript) marks.push({ type: 'subscript' });
  if (style.smallCaps) marks.push({ type: 'smallCaps' });
  
  // Add textStyle mark if any text style attributes are set
  const textStyleAttrs: Record<string, unknown> = {};
  if (style.color) textStyleAttrs.color = style.color;
  if (style.backgroundColor) textStyleAttrs.backgroundColor = style.backgroundColor;
  if (style.fontSize) textStyleAttrs.fontSize = style.fontSize;
  if (style.fontFamily) textStyleAttrs.fontFamily = style.fontFamily;
  
  if (Object.keys(textStyleAttrs).length > 0) {
    marks.push({ type: 'textStyle', attrs: textStyleAttrs });
  }
  
  return marks;
}

/**
 * Convert inline content array to ProseMirror content
 * @param content - The inline content array
 * @param stylePool - Optional style pool for looking up styles by ID
 */
function inlineContentToPm(content: InlineContent[], stylePool?: TextStylePool): PmNodeJSON[] {
  if (!content || content.length === 0) {
    return [];
  }
  
  return content.map(item => {
    if (item.type === 'text') {
      const result: PmNodeJSON = { type: 'text', text: item.text };
      let marks: PmMarkJSON[] = [];
      
      // Check if using styleId (style pool reference)
      if (item.styleId && stylePool) {
        const style = stylePool.get(item.styleId);
        if (style) {
          marks = styleToMarks(style);
        }
      } else {
        // Use inline styles
        const inlineStyle: TextStyle = {};
        if (item.bold) inlineStyle.bold = true;
        if (item.italic) inlineStyle.italic = true;
        if (item.underline) inlineStyle.underline = true;
        if (item.strikethrough) inlineStyle.strikethrough = true;
        if (item.superscript) inlineStyle.superscript = true;
        if (item.subscript) inlineStyle.subscript = true;
        if (item.smallCaps) inlineStyle.smallCaps = true;
        if (item.color) inlineStyle.color = item.color;
        if (item.backgroundColor) inlineStyle.backgroundColor = item.backgroundColor;
        if (item.fontSize) inlineStyle.fontSize = item.fontSize;
        if (item.fontFamily) inlineStyle.fontFamily = item.fontFamily;
        
        marks = styleToMarks(inlineStyle);
      }

      if (item.commentThreadId) {
        marks.push({ type: 'comment', attrs: { threadId: item.commentThreadId } });
      }

      if (marks.length > 0) {
        result.marks = marks;
      }
      
      return result;
    }
    
    if (item.type === 'link') {
      const marks: PmMarkJSON[] = [{ type: 'link', attrs: { href: item.href } }];
      if (item.commentThreadId) {
        marks.push({ type: 'comment', attrs: { threadId: item.commentThreadId } });
      }
      return { type: 'text', text: item.text, marks };
    }
    
    // Inline images would need special handling
    return null;
  }).filter((node): node is PmNodeJSON => node !== null);
}

/**
 * Convert ProseMirror document back to our document model
 * @param pmDoc - The ProseMirror document
 * @param existingDoc - The existing document to update
 * @param stylePool - Optional style pool for deduplicating styles (recommended for large documents)
 */
export function proseMirrorToDocument(
  pmDoc: PmNode, 
  existingDoc: Document,
  stylePool?: TextStylePool
): Document {
  const blocks: Block[] = [];
  let blockIndex = 0;
  
  pmDoc.forEach((node) => {
    const convertedBlocks = pmNodeToBlocks(node, blockIndex, stylePool);
    blocks.push(...convertedBlocks);
    blockIndex += convertedBlocks.length;
  });
  
  // Ensure at least one paragraph
  if (blocks.length === 0) {
    blocks.push({
      id: `block_${Date.now()}`,
      type: 'paragraph',
      content: [],
    });
  }
  
  return {
    ...existingDoc,
    sections: [{
      ...existingDoc.sections[0],
      blocks,
    }],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Convert ProseMirror node to our block model
 * Returns an array because some nodes (like lists) expand to multiple blocks
 */
function pmNodeToBlocks(node: PmNode, startIndex: number, stylePool?: TextStylePool): Block[] {
  switch (node.type.name) {
    case 'paragraph': {
      const block: ParagraphBlock = {
        id: `block_${startIndex}_${Date.now()}`,
        type: 'paragraph',
        content: pmContentToInline(node, stylePool),
      };
      // Extract paragraph attributes
      if (node.attrs.alignment && node.attrs.alignment !== 'left') {
        block.alignment = node.attrs.alignment;
      }
      if (node.attrs.indent && node.attrs.indent !== 0) {
        block.indent = node.attrs.indent;
      }
      if (node.attrs.spaceBefore && node.attrs.spaceBefore !== 0) {
        block.spaceBefore = node.attrs.spaceBefore;
      }
      if (node.attrs.spaceAfter && node.attrs.spaceAfter !== 8) {
        block.spaceAfter = node.attrs.spaceAfter;
      }
      return [block];
    }
      
    case 'heading': {
      const block: HeadingBlock = {
        id: `block_${startIndex}_${Date.now()}`,
        type: 'heading',
        level: node.attrs.level as 1 | 2 | 3 | 4 | 5 | 6,
        content: pmContentToInline(node, stylePool),
      };
      // Extract heading alignment
      if (node.attrs.alignment && node.attrs.alignment !== 'left') {
        block.alignment = node.attrs.alignment;
      }
      return [block];
    }
      
    case 'bullet_list':
    case 'ordered_list': {
      const blocks: Block[] = [];
      const listType = node.type.name === 'bullet_list' ? 'bullet' : 'numbered';
      
      node.forEach((listItem, _, index) => {
        // Get the first paragraph content from the list item
        let content: InlineContent[] = [];
        listItem.forEach((child) => {
          if (child.type.name === 'paragraph') {
            content = pmContentToInline(child, stylePool);
          }
        });
        
        blocks.push({
          id: `block_${startIndex + index}_${Date.now()}`,
          type: 'list-item',
          listType,
          level: 0,
          content,
        });
      });
      
      return blocks;
    }
      
    case 'table': {
      const rows: TableRow[] = [];
      node.forEach((rowNode) => {
        const cells: TableCell[] = [];
        rowNode.forEach((cellNode) => {
          let content: InlineContent[] = [];
          cellNode.forEach((child) => {
            if (child.type.name === 'paragraph') {
              content = pmContentToInline(child, stylePool);
            }
          });
          cells.push({
            id: `cell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content,
            colspan: cellNode.attrs.colspan,
            rowspan: cellNode.attrs.rowspan,
          });
        });
        rows.push({
          id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          cells,
        });
      });
      
      return [{
        id: `block_${startIndex}_${Date.now()}`,
        type: 'table',
        rows,
      }];
    }
      
    case 'image':
      return [{
        id: `block_${startIndex}_${Date.now()}`,
        type: 'image',
        src: node.attrs.src,
        alt: node.attrs.alt,
        width: node.attrs.width || 300,
        height: node.attrs.height || 200,
        alignment: node.attrs.alignment,
      }];
      
    case 'horizontal_rule':
      return [{
        id: `block_${startIndex}_${Date.now()}`,
        type: 'horizontal-rule',
      }];
      
    case 'page_break':
      return [{
        id: `block_${startIndex}_${Date.now()}`,
        type: 'page-break',
      }];
      
    default:
      return [];
  }
}

/**
 * Extract TextStyle from ProseMirror marks
 */
function extractStyleFromMarks(marks: readonly Mark[]): TextStyle | null {
  const style: TextStyle = {};
  let hasStyle = false;
  
  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        style.bold = true;
        hasStyle = true;
        break;
      case 'italic':
        style.italic = true;
        hasStyle = true;
        break;
      case 'underline':
        style.underline = true;
        hasStyle = true;
        break;
      case 'strikethrough':
        style.strikethrough = true;
        hasStyle = true;
        break;
      case 'superscript':
        style.superscript = true;
        hasStyle = true;
        break;
      case 'subscript':
        style.subscript = true;
        hasStyle = true;
        break;
      case 'smallCaps':
        style.smallCaps = true;
        hasStyle = true;
        break;
      case 'textStyle':
        if (mark.attrs.color) { style.color = mark.attrs.color; hasStyle = true; }
        if (mark.attrs.backgroundColor) { style.backgroundColor = mark.attrs.backgroundColor; hasStyle = true; }
        if (mark.attrs.fontSize) { style.fontSize = mark.attrs.fontSize; hasStyle = true; }
        if (mark.attrs.fontFamily) { style.fontFamily = mark.attrs.fontFamily; hasStyle = true; }
        break;
    }
  }
  
  return hasStyle ? style : null;
}

/**
 * Convert ProseMirror node content to our inline content format
 * @param node - The ProseMirror node
 * @param stylePool - Optional style pool for deduplicating styles
 */
function pmContentToInline(node: PmNode, stylePool?: TextStylePool): InlineContent[] {
  const content: InlineContent[] = [];
  
  node.forEach((child) => {
    if (child.isText) {
      const text = child.text || '';

      // A comment mark anchors a thread to this run.
      const commentMark = child.marks.find((m) => m.type.name === 'comment');
      const commentThreadId = commentMark
        ? (commentMark.attrs.threadId as string)
        : undefined;

      // Check for link mark
      const linkMark = child.marks.find(m => m.type.name === 'link');
      let item: InlineContent;
      if (linkMark) {
        item = {
          type: 'link',
          text,
          href: linkMark.attrs.href,
        } as InlineLink;
      } else {
        // Extract style from marks
        const style = extractStyleFromMarks(child.marks);

        if (style && stylePool) {
          // Use style pool for deduplication (recommended for large documents)
          const styleId = stylePool.getOrCreate(style);
          item = { type: 'text', text, styleId } as TextRun;
        } else if (style) {
          // Inline styles (fallback when no style pool provided)
          item = { type: 'text', text, ...style } as TextRun;
        } else {
          // Plain text with no styling
          item = { type: 'text', text } as TextRun;
        }
      }

      if (commentThreadId) {
        (item as TextRun | InlineLink).commentThreadId = commentThreadId;
      }
      content.push(item);
    }
  });
  
  return content;
}

/**
 * Create a ProseMirror document node from JSON
 */
export function createPmDoc(json: PmNodeJSON): PmNode {
  return docsSchema.nodeFromJSON(json);
}

/**
 * Convert an array of blocks to a ProseMirror document node
 * @param blocks - The blocks to convert
 * @param stylePool - Optional style pool for looking up styles by ID
 */
export function blocksToPmDoc(blocks: Block[], stylePool?: TextStylePool): PmNode {
  const rawNodes = blocks
    .map(block => blockToPmNode(block, stylePool))
    .filter((node): node is PmNodeJSON => node !== null);

  // Group consecutive list items into single list nodes
  const content: PmNodeJSON[] = [];
  let currentList: { type: string; listType: ListType | undefined; items: PmNodeJSON[] } | null = null;
  
  for (const node of rawNodes) {
    if (node.type === '__list_item__') {
      // This is a list item that needs to be grouped
      const listType = node.listType === 'bullet' ? 'bullet_list' : 'ordered_list';
      
      if (currentList && currentList.listType === node.listType) {
        // Add to existing list
        currentList.items.push(...(node.content ?? []));
      } else {
        // Finish previous list if any
        if (currentList) {
          content.push({
            type: currentList.type,
            content: currentList.items,
          });
        }
        // Start new list
        currentList = {
          type: listType,
          listType: node.listType,
          items: [...(node.content ?? [])],
        };
      }
    } else {
      // Regular node - flush any pending list
      if (currentList) {
        content.push({
          type: currentList.type,
          content: currentList.items,
        });
        currentList = null;
      }
      content.push(node);
    }
  }
  
  // Flush final list if any
  if (currentList) {
    content.push({
      type: currentList.type,
      content: currentList.items,
    });
  }
  
  const json = {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  };
  
  return docsSchema.nodeFromJSON(json);
}

/**
 * Get plain text from a ProseMirror node
 */
export function getPmPlainText(node: PmNode): string {
  let text = '';
  node.descendants((child) => {
    if (child.isText) {
      text += child.text;
    }
  });
  return text;
}

/**
 * Check if a ProseMirror document is empty
 */
export function isDocEmpty(doc: PmNode): boolean {
  if (doc.childCount === 0) return true;
  if (doc.childCount === 1) {
    const child = doc.firstChild;
    if (child && child.type.name === 'paragraph' && child.content.size === 0) {
      return true;
    }
  }
  return false;
}

