
const codeRegex = /```(.*)(\r\n|\r|\n)(?<code>[\w\W\n]+)(\r\n|\r|\n)```/;

export function preprocessJsonInput(text) {
  try {
    return text.match(codeRegex).groups.code.trim();
  } catch (e) {
    return text.trim()
  }
}

export function parseArr(text) {
  try {
    if (text.startsWith("[") && text.endsWith("]")) {
      return JSON.parse(text);
    }
    return text.match(codeRegex).groups.code.trim();
  } catch (e) {
    throw new Error("No code found")
    // try {
    //   const regexPattern = /\[(.*?)\]/g;
    //   const matches = text.match(regexPattern)[1];
    //   console.log({ matches })
    //   if (!matches) {
    //     throw new Error("No code found")
    //   }
    //   return matches;
    // } catch (error) {
    //   throw new Error("No code found")
    // }
  }
}


export { parseSite } from './page-parser.js';
