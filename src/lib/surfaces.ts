// The Mantl product surface a prototype is for. Ids are stored in
// prototypes.surface and must match the check constraint in
// supabase/migrations/20261112090000_prototype_surface.sql.
export const prototypeSurfaces = [
  { id: "console", label: "Console", hint: "The banker-facing Console" },
  { id: "self_serve", label: "Self-serve", hint: "The customer-facing self-serve experience" },
] as const;

export type PrototypeSurfaceId = (typeof prototypeSurfaces)[number]["id"];
