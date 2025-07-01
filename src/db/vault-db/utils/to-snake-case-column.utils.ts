export const toSnakeCaseColumn = (field: string, exceptionsMap?: Record<string, string>): string =>
  exceptionsMap[field] ??
  field
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
