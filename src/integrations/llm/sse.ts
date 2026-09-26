// src/integrations/llm/sse.ts — minimal Server-Sent Events reader for fetch() bodies.
// Handles arbitrary chunk boundaries, CRLF, comment lines and multi-line data fields.

export async function readSSE(body: ReadableStream<Uint8Array>, onData: (data: string) => void): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let dataLines: string[] = []

    const dispatch = () => {
        if (dataLines.length === 0) {
            return
        }
        const data = dataLines.join('\n')
        dataLines = []
        onData(data)
    }

    const handleLine = (rawLine: string) => {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
        if (line === '') {
            dispatch()
            return
        }
        if (line.startsWith(':')) {
            return
        }
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        let value = colon === -1 ? '' : line.slice(colon + 1)
        if (value.startsWith(' ')) {
            value = value.slice(1)
        }
        if (field === 'data') {
            dataLines.push(value)
        }
    }

    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }
            buffer += decoder.decode(value, { stream: true })
            let newline = buffer.indexOf('\n')
            while (newline !== -1) {
                handleLine(buffer.slice(0, newline))
                buffer = buffer.slice(newline + 1)
                newline = buffer.indexOf('\n')
            }
        }
        buffer += decoder.decode()
        if (buffer) {
            handleLine(buffer)
        }
        dispatch()
    } catch (error) {
        await reader.cancel().catch(() => undefined)
        throw error
    } finally {
        reader.releaseLock()
    }
}
