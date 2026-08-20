/** Remove SEO-stuffer calendar years from titles (models love "in 2025"). */
export function stripCalendarYearsFromTitle(title: string): string {
  return title
    .replace(/\s+in\s+20\d{2}\b/gi, "")
    .replace(/\s+for\s+20\d{2}\b/gi, "")
    .replace(/\s*\(20\d{2}\)\s*/g, " ")
    .replace(/:\s*20\d{2}\s+guide/gi, " guide")
    .replace(/\s+20\d{2}$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Strip year suffixes from URL slugs. */
export function stripCalendarYearsFromSlug(slug: string): string {
  return slug
    .replace(/-in-20\d{2}$/i, "")
    .replace(/-20\d{2}$/i, "")
    .replace(/-for-20\d{2}$/i, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Remove calendar-year SEO filler from HTML body copy. */
export function sanitizeArticleHtmlYears(html: string): string {
  return html
    .replace(/\bin 20\d{2}\b/gi, "today")
    .replace(/\bfor 20\d{2}\b/gi, "")
    .replace(/\bas of 20\d{2}\b/gi, "")
    .replace(/\s{2,}/g, " ");
}

export function sanitizeBlogArticleFields(article: {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaDescription: string;
}): typeof article {
  const title = stripCalendarYearsFromTitle(article.title);
  let slug = stripCalendarYearsFromSlug(article.slug);
  if (!slug) slug = article.slug;

  return {
    title,
    slug,
    content: sanitizeArticleHtmlYears(article.content),
    excerpt: stripCalendarYearsFromTitle(article.excerpt),
    metaDescription: stripCalendarYearsFromTitle(article.metaDescription),
  };
}
