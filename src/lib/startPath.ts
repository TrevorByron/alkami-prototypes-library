import type { PrototypeSummary } from "@/lib/types";

// A prototype's start page: what is added to its link when someone launches it.
// Stored on its own column (start_path), not in url, because a MANTL share
// rewrites url. It is kept relative to the link where it can be: "accounts/home"
// and "#/loans" and "?screen=2" follow the link if it moves, and "/x" is from the
// site root.

export const startPathMaxLength = 500;

/** The address a launch should open: the link, plus the start page when there is one. */
export function launchUrl(prototype: Pick<PrototypeSummary, "url" | "start_path">) {
  const start = prototype.start_path?.trim();
  if (!start) return prototype.url;
  try {
    const base = new URL(prototype.url);
    if (start.startsWith("#")) { base.hash = start; return base.toString(); }
    if (start.startsWith("?")) {
      const [query, hash = ""] = start.split("#");
      base.search = query; base.hash = hash ? `#${hash}` : "";
      return base.toString();
    }
    if (start.startsWith("/")) return new URL(start, base.origin).toString();
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    return new URL(start, base).toString();
  } catch { return prototype.url; }
}

export type StartPathResult = { path: string | null; error?: never } | { path?: never; error: string };

/** Turns what was pasted (a full address or a path) into what is stored. Empty clears it. */
export function parseStartPath(input: string, baseUrl: string): StartPathResult {
  const text = input.trim();
  if (!text) return { path: null };
  let base: URL;
  try { base = new URL(baseUrl); } catch { return { error: "This prototype’s link isn’t a valid address." }; }

  let path = text;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    let pasted: URL;
    try { pasted = new URL(text); } catch { return { error: "That isn’t a valid address." }; }
    if (pasted.protocol !== "https:" && pasted.protocol !== "http:") return { error: "Use a web address (https://…) or a path like /accounts." };
    if (pasted.origin !== base.origin) return { error: `That is on a different site. The start page has to be on ${base.host}.` };
    const prefix = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
    const rest = `${pasted.pathname}${pasted.search}${pasted.hash}`;
    if (pasted.pathname.startsWith(prefix) && prefix !== "/") path = rest.slice(prefix.length) || "";
    else if (pasted.pathname === base.pathname) path = `${pasted.search}${pasted.hash}`;
    else path = rest;
  } else if (text.startsWith("//")) return { error: "Use a path like /accounts, not a // address." };
  else if (!/^[/#?]/.test(text)) path = text;
  if (/\s/.test(path)) return { error: "A start page can’t contain spaces." };
  if (path.length > startPathMaxLength) return { error: "That start page is too long." };
  return { path: path || null };
}
