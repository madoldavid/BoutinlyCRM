import sanitizeHtml from 'sanitize-html';

const DEFAULT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'span', 'div', 'br', 'hr',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['style', 'class', 'id', 'align'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan', 'style'],
    th: ['colspan', 'rowspan', 'style'],
    table: ['style', 'border', 'cellpadding', 'cellspacing'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['data', 'https'],
  },
  allowProtocolRelative: false,
};

/**
 * Sanitize user-supplied HTML to prevent XSS while preserving
 * common email formatting tags and attributes.
 */
export function sanitizeHtmlContent(dirty: string, options?: sanitizeHtml.IOptions): string {
  return sanitizeHtml(dirty, options ?? DEFAULT_OPTIONS);
}
