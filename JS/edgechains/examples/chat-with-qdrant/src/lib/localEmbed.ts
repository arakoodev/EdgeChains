/**
 * Tiny bag-of-words embedding so the example can run without OpenAI.
 * Swap in OpenAI embeddings (vector size 1536) for production.
 */
export function localEmbed(text: string, size = 32): number[] {
    const vec = new Array(size).fill(0);
    const tokens = String(text).toLowerCase().split(/\W+/).filter(Boolean);
    for (const token of tokens) {
        let hash = 0;
        for (let i = 0; i < token.length; i++) {
            hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
        }
        vec[hash % size] += 1;
    }
    const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vec.map((value) => value / norm);
}
