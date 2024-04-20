"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextSplitter = void 0;
class TextSplitter {
    splitTextIntoChunks(text, chunkSize) {
        return new Promise((resolve, reject) => {
            try {
                text = text.split("\n").join(" ");
                const chunks = [];
                for (let i = 0; i < text.length; i += chunkSize) {
                    chunks.push(text.substring(i, i + chunkSize));
                }
                resolve(chunks);
            } catch (error) {
                console.error("Error splitting text into chunks:", error);
                reject(error);
            }
        });
    }
}
exports.TextSplitter = TextSplitter;
