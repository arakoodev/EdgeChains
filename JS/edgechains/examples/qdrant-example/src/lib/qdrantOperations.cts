const { Qdrant } = require("@arakoodev/edgechains.js/vector-db");

async function runQdrant(url: string) {
    try {
        const qdrant = new Qdrant({ url });
        const collectionName = "example_collection";
        
        console.log("Creating collection...");
        await qdrant.createCollection(collectionName, 4, "Cosine");
        
        console.log("Upserting points...");
        await qdrant.upsertPoints(collectionName, [
            { id: 1, vector: [0.1, 0.2, 0.3, 0.4], payload: { city: "London" } },
            { id: 2, vector: [0.2, 0.3, 0.4, 0.5], payload: { city: "Paris" } },
        ]);
        
        console.log("Searching points...");
        const searchRes = await qdrant.searchPoints(collectionName, [0.1, 0.2, 0.3, 0.4], 1);
        console.log("Search result:", JSON.stringify(searchRes));
        
        console.log("Deleting collection...");
        await qdrant.deleteCollection(collectionName);
        
        return { success: true, searchResult: searchRes };
    } catch (error: any) {
        console.error("Qdrant error:", error);
        return { success: false, error: error.message };
    }
}

module.exports = runQdrant;
