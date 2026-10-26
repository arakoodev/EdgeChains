import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Qdrant } from '../dist/vector-db/src/index.js'

const db = new Qdrant(process.env.QDRANT_URL || 'http://127.0.0.1:6333', process.env.QDRANT_API_KEY)
const collectionName = `edgechains-demo-${randomUUID()}`
const collection = { collectionName }
const step = async (title, operation) => {
  const result = await operation()
  console.log(title)
  console.log(JSON.stringify(result))
  return result
}
await step('Create collection: 3 dimensions, cosine distance', () => db.createCollection({ ...collection, size: 3 }))
try {
  await step('Insert three vectors and document payloads', () => db.insertVectorData({ ...collection, points: [
    { id: 1, vector: [1, 0, 0], payload: { text: 'Qdrant REST guide', category: 'guide' } },
    { id: 2, vector: [0, 1, 0], payload: { text: 'Other document', category: 'other' } },
    { id: 3, vector: [0.8, 0.2, 0], payload: { text: 'Vector search guide', category: 'guide' } },
  ] }))
  const results = await step('Search [1,0,0], filtered to guides; best match first', () => db.getDataFromQuery({ ...collection, vector: [1, 0, 0], filter: { must: [{ key: 'category', match: { value: 'guide' } }] }, limit: 2 }))
  assert.deepEqual(results.map(point => point.id), [1, 3])
  const page = await step('Scroll page one (2 points) and retain its cursor', () => db.getData({ ...collection, limit: 2 }))
  assert.equal(page.next_page_offset, 3)
  await step('Scroll page two using that cursor', () => db.getData({ ...collection, offset: page.next_page_offset, limit: 2 }))
  await step('Update payload of point 1', () => db.updateById({ ...collection, id: 1, updatedContent: { text: 'Updated REST guide' } }))
  const updated = await step('Retrieve point 1; existing category is preserved', () => db.getDataById({ ...collection, id: 1, withVectors: true }))
  assert.equal(updated.payload.text, 'Updated REST guide')
  assert.equal(updated.payload.category, 'guide')
  await step('Delete point 1 and confirm it is absent', () => db.deleteById({ ...collection, id: 1 }))
  assert.equal(await db.getDataById({ ...collection, id: 1 }), null)
  console.log('PASS: search order, pagination, payload merge and deletion verified')
} finally {
  await step('Delete only the temporary demo collection', () => db.deleteCollection(collection))
}
