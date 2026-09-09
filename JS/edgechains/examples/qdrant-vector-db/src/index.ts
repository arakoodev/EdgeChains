import { config } from "dotenv";
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

config();

const collectionName = "documents";

async function main() {
  const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

  await qdrant.createCollection({
    collectionName,
    vectors: {
      size: 3,
      distance: "Cosine",
    },
  });

  await qdrant.upsertPoints({
    collectionName,
    points: [
      {
        id: 1,
        vector: [0.1, 0.2, 0.3],
        payload: { content: "EdgeChains supports Qdrant" },
      },
      {
        id: 2,
        vector: [0.2, 0.1, 0.4],
        payload: { content: "Qdrant stores vector points" },
      },
    ],
  });

  const result = await qdrant.searchPoints({
    collectionName,
    vector: [0.1, 0.2, 0.31],
    limit: 2,
  });

  console.log(JSON.stringify(result, null, 2));

  await qdrant.deletePoints({ collectionName, points: [1, 2] });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
