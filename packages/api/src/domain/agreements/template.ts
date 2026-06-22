/**
 * Clause-based template rendering. Agreements are assembled from a versioned
 * library of clauses with `{{variable}}` placeholders; rendering interpolates the
 * party/rent/term/etc. values and reports any variables left unfilled.
 */

export interface ClauseInput {
  key: string;
  title: string;
  body: string;
}

export interface RenderedClause {
  key: string;
  title: string;
  body: string;
}

export interface RenderResult {
  clauses: RenderedClause[];
  text: string;
  missing: string[];
}

export type TemplateVars = Record<string, string | number | null | undefined>;

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

export function interpolate(template: string, vars: TemplateVars): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(VAR_RE, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null || value === '') {
      missing.add(key);
      return `{{${key}}}`;
    }
    return String(value);
  });
  return { text, missing: [...missing] };
}

export function renderClauses(clauses: ClauseInput[], vars: TemplateVars): RenderResult {
  const rendered: RenderedClause[] = [];
  const missing = new Set<string>();

  for (const clause of clauses) {
    const title = interpolate(clause.title, vars);
    const body = interpolate(clause.body, vars);
    title.missing.forEach((m) => missing.add(m));
    body.missing.forEach((m) => missing.add(m));
    rendered.push({ key: clause.key, title: title.text, body: body.text });
  }

  const text = rendered.map((c, i) => `${i + 1}. ${c.title}\n${c.body}`).join('\n\n');
  return { clauses: rendered, text, missing: [...missing] };
}
