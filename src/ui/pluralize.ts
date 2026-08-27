/** Shared count-and-noun formatting so inventories never render "1 containers". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
