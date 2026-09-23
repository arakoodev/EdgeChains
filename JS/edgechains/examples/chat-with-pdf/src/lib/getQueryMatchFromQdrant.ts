import { qdrant } from "./InsertToQdrant.js";

export function getQueryMatchFromQdrant() {
    return function (embeddings: any) {
        const response = qdrant
            .searchVectors({
                collectionName: qdrant.collectionName,
                queryVector: JSON.parse(embeddings)[0].embedding,
                top: 5
            })
            .then((response: any) => {
                const contentArr: string[] = [];
                for (let i = 0; i < response?.length; i++) {
                    const element = response[i];
                    contentArr.push(element.content);
                }
                return contentArr.join(" ");
            });
        return response;
    };
}
