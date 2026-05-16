// src/utils/import-csv.ts
// Generic CSV row parser — handles quoted values with embedded commas and "" escapes.
// Migrated from class GammaLedger during the TypeScript module split.

export function parseCsvRow(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }
    values.push(current);

    return values;
}
