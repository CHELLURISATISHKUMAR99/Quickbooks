const SUFFIXES = [
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "ltd",
  "limited",
  "lp",
  "llp",
];

export function generateSlug(businessName: string): string {
  let s = businessName.toLowerCase().trim();
  s = s.replace(/[^a-z0-9\s]/g, "");
  const parts = s.split(/\s+/).filter(Boolean);
  while (parts.length > 1 && SUFFIXES.includes(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join("");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]{2,40}$/.test(slug);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
