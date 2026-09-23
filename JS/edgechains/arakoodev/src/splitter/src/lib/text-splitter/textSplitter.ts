export class TextSplitter {
  splitTextIntoChunks(text: string, chunkSize: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        text = text.split("\n").join(" ");
        const chunks: string[] = [];
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
