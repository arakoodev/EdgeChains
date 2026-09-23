// Run after building the SDK: node examples/qdrant.cjs
const { QdrantClient } = require('../dist/vector-db/src/index.js');

async function main() {
    const client = new QdrantClient({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        apiKey: process.env.QDRANT_API_KEY,
    });
    const collection = `edgechains_demo_${Date.now()}`;
    console.log('Create a temporary collection with 3-dimensional Cosine vectors');
    console.log(await client.createCollection(collection, { size: 3, distance: 'Cosine' }));
    try {
        console.log('Insert two documents and one document in a different namespace');
        console.log(await client.upsert(collection, [
            { id: 1, vector: [1, 0, 0], payload: { namespace: 'docs', text: 'First document' } },
            { id: 2, vector: [0, 1, 0], payload: { namespace: 'docs', text: 'Second document' } },
            { id: 3, vector: [1, 0, 0], payload: { namespace: 'other', text: 'Excluded document' } },
        ]));
        const query = {
            query: [1, 0, 0], limit: 2,
            filter: { must: [{ key: 'namespace', match: { value: 'docs' } }] },
        };
        console.log('Search for [1,0,0], restricted to namespace=docs');
        console.log(JSON.stringify(await client.query(collection, query), null, 2));
        console.log('Delete point 1 and query again');
        await client.deletePoints(collection, [1]);
        console.log(JSON.stringify(await client.query(collection, query), null, 2));
    } finally {
        await client.deleteCollection(collection);
        console.log('Temporary collection removed');
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
