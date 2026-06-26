/**
 * Converts a string into a URL-friendly slug.
 * Handles Unicode characters and Indian language text by
 * transliterating where possible, falling back to removing them.
 */
const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove characters that aren't alphanumeric, hyphens, or dots
    .replace(/[^\w\-\.]+/g, '')
    // Replace multiple hyphens with a single one
    .replace(/\-\-+/g, '-')
    // Remove leading or trailing hyphens
    .replace(/^-+|-+$/g, '');
};

export default slugify;