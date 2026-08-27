/**
 * Control-character checks used across profile validation and safe diagnostics.
 *
 * These live here as character-code checks rather than regular expressions so
 * the intent is readable and no control character has to appear in a pattern.
 */
const CONTROL_CHARACTER = (code: number): boolean => code <= 0x1f || code === 0x7f;

export function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) if (CONTROL_CHARACTER(value.charCodeAt(index))) return true;
  return false;
}

/** Collapses control characters to a replacement so daemon text stays printable. */
export function stripControlCharacters(value: string, replacement = ""): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    result += CONTROL_CHARACTER(value.charCodeAt(index)) ? replacement : character;
  }
  return result;
}

/** True when the value contains a character outside basic ASCII. */
export function hasNonAsciiCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) if (value.charCodeAt(index) > 0x7f) return true;
  return false;
}
