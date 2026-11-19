import { displayName } from "@/lib/names";

// Guesses whether a GitHub login (the author of a Prototyping in MANTL share)
// belongs to a member, from the member's name. It only has to be good enough
// to ask "Is this you?": the member confirms or says no.
//
// "Trevor Borden" matches TrevorByron, trevor-borden, tborden, trevorb and
// bordentrevor. A first name alone (trevor) or someone else's last initial
// (TrevorSmith) does not.

// "TrevorByron" → ["trevor", "byron"]; "t-borden_2" → ["t", "borden"].
export function loginParts(login: string) {
  return login
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

function nameParts(name: string) {
  return displayName(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** 0 when the login doesn't look like this person; higher is a closer match. */
export function githubNameScore(login: string, name: string) {
  const person = nameParts(name);
  if (person.length < 2) return 0;
  const first = person[0];
  const last = person[person.length - 1];
  if (first.length < 2 || last.length < 2) return 0;
  const parts = loginParts(login);
  const compact = parts.join("");
  if (!compact) return 0;

  // The whole name, either way round, or an initial and the other name.
  if ([first + last, last + first, first[0] + last, first + last[0], last[0] + first].includes(compact)) return 3;
  // Both names somewhere in the login: trevorborden42, the-trevor-borden.
  if (compact.includes(first) && compact.includes(last)) return 3;
  // First name, then a different word starting with the last name's initial:
  // TrevorByron, trevor-bee. Common for people who don't use their legal surname.
  if (parts.length >= 2 && parts[0] === first && parts[parts.length - 1][0] === last[0]) return 2;
  if (parts.length === 1 && compact.startsWith(first) && compact.length > first.length && compact[first.length] === last[0]) return 2;
  // Initial plus surname written as one word: tborden2.
  if (last.length >= 4 && compact.startsWith(first[0]) && compact.includes(last)) return 2;
  return 0;
}

/** The likeliest of these logins for this person, or null. */
export function bestGithubMatch(logins: string[], name: string) {
  let best: { login: string; score: number } | null = null;
  for (const login of logins) {
    const score = githubNameScore(login, name);
    if (score && (!best || score > best.score)) best = { login, score };
  }
  return best?.login ?? null;
}

// Logins that aren't a person: bots and the fallback register-prototype uses.
export function isPersonLogin(login: string) {
  return Boolean(login) && login !== "Unknown" && !/\[bot\]$|-bot$|^github-actions/i.test(login);
}
