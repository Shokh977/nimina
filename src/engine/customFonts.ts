/**
 * User-uploaded fonts (Pro). The project carries a small registry of the
 * custom fonts it uses (`project.customFonts`: id, family name, weight), so
 * rendering stays pure and self-contained; the app loads the actual files
 * (src/components/customFontLoader.ts) under a collision-proof internal
 * family name — never the font's own name, which could clash with a font
 * installed on the user's computer and silently render that instead.
 *
 * A font choice is a string: '0'…'5' for the built-ins (index into FONTS)
 * or 'u:<id>' for an uploaded one. The project's default is `project.font`
 * (built-in index) unless `project.customFont` names an uploaded one; a
 * slide/intro/outro can override it with `style.font`.
 */
import { FONTS } from './constants';
import type { CustomFontRef, FontDef, Project } from './types';

export function customFontFamily(id: string): string {
  return `Nimina Upload ${id}`;
}

export function customFontDef(ref: CustomFontRef): FontDef {
  // One uploaded file is one face: headline and body use its own weight
  // (the face is registered for every weight, so nothing gets faux-bolded).
  return { name: customFontFamily(ref.id), h: ref.weight, s: ref.weight, label: ref.family };
}

/** The FontDef for a font choice, falling back to the project default (and
 * then the first built-in) when it can't be resolved — e.g. a deleted upload. */
export function fontForChoice(project: Project, choice: string | undefined): FontDef {
  if (choice !== undefined && choice !== '') {
    if (choice.startsWith('u:')) {
      const ref = project.customFonts?.find((f) => f.id === choice.slice(2));
      if (ref) return customFontDef(ref);
    } else if (FONTS[Number(choice)]) return FONTS[Number(choice)];
  }
  return projectFont(project);
}

/** The project-wide font. */
export function projectFont(project: Project): FontDef {
  if (project.customFont) {
    const ref = project.customFonts?.find((f) => f.id === project.customFont);
    if (ref) return customFontDef(ref);
  }
  return FONTS[project.font] ?? FONTS[0];
}

/** Every uploaded font a project actually uses (project default + slide overrides). */
export function customFontsInUse(project: Project): CustomFontRef[] {
  const ids = new Set<string>();
  if (project.customFont) ids.add(project.customFont);
  const owners = [project.intro, project.outro, ...project.scenes];
  for (const o of owners) {
    const f = (o as { style?: { font?: string } }).style?.font;
    if (f?.startsWith('u:')) ids.add(f.slice(2));
  }
  return (project.customFonts ?? []).filter((f) => ids.has(f.id));
}
