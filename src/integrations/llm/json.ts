// src/integrations/llm/json.ts — lenient JSON recovery for model replies (plain, fenced, or embedded).

export function parseJsonLenient(content: string): unknown {
    const trimmed = (content || '').trim()
    try {
        return JSON.parse(trimmed)
    } catch {
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
        if (fenced) {
            return JSON.parse(fenced)
        }
        const start = trimmed.indexOf('{')
        const end = trimmed.lastIndexOf('}')
        if (start !== -1 && end > start) {
            return JSON.parse(trimmed.slice(start, end + 1))
        }
        throw new Error('Model reply was not valid JSON.')
    }
}
