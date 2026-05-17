import { parse } from "node-html-parser";
import { JSDOM } from "jsdom";
const { document } = new JSDOM(`...`).window;

const tagsToLog = [
    "a",
    "p",
    "span",
    "div",
    "button",
    "label",
    "input",
    "textarea",
    "section",
    "select",
    "option",
    "table",
    "td",
    "th",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "iframe",
];

function createElement(node) {
    const elem = document.createElement(node.tagName);

    const dataAttributes = Object.entries(node.attributes).filter(
        (a) =>
            (tagsToLog.includes(node.tagName) &&
                (a[0].startsWith("name") ||
                    a[0].startsWith("value") ||
                    a[0].startsWith("data-component") ||
                    a[0].startsWith("data-name") ||
                    a[0].startsWith("aria-") ||
                    a[0] === "class" ||
                    a[0] === "type" ||
                    a[0] === "role")) ||
            a[0] === "href" ||
            a[0] === "id" ||
            a[0] === "type"
    );
    dataAttributes.forEach(([attr, value]) => {
        elem.setAttribute(attr, value);
    });

    return elem;
}

function createTextNode(text) {
    return document.createTextNode(text);
}

function isAdsIframe(node) {
    const style = node.getAttribute("style") || "";
    const id = node.getAttribute("id") || "";
    return (
        node.getAttribute("height") === 0 ||
        style.includes("display: none") ||
        id.startsWith("google_ads_iframe")
    );
}

async function dfs(node, parentElem, childFrames = []) {
    for (const childNode of node.childNodes) {
        if (childNode.nodeType === 1) {
            if (childNode.tagName === "IFRAME") {
                // optimize for performance later
                for (let { childFrame, attributes } of childFrames) {
                    if (
                        Object.entries(attributes).every(
                            ([attr, value]) => childNode.getAttribute(attr) === value
                        )
                    ) {
                        // skip blocks that look like ads
                        if (isAdsIframe(childNode)) {
                            continue;
                        }

                        const childElem = createElement(childNode);
                        parentElem.appendChild(childElem);
                        const newChildFrame = await toChildFramesWithAttributes(childFrame);
                        //@ts-ignore
                        const bodyNode = await childFrame.locator("body", { timeout: 1000 });
                        const bodyHtml = await bodyNode.innerHTML();
                        await dfs(parseFrame(bodyHtml), childElem, newChildFrame);
                        // ignore other matches that might be the same parent
                        break;
                    }
                }
            } else {
                const childElem = createElement(childNode);
                parentElem.appendChild(childElem);
                await dfs(childNode, childElem, childFrames);
            }
        } else if (childNode.nodeType === 3) {
            if (!childNode.isWhitespace) {
                const textElem = createTextNode(childNode);
                parentElem.appendChild(textElem);
            }
        }
    }
}

async function toChildFramesWithAttributes(frame) {
    const childFramesWithAttributes: any = [];
    for (let childFrame of frame.childFrames()) {
        const childFrameElement = await childFrame.frameElement();
        const attributes = await childFrameElement.evaluate((node) => {
            const attrs = {};
            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];
                attrs[attr.name] = attr.value;
            }
            return attrs;
        });
        childFramesWithAttributes.push({ childFrame, attributes });
    }
    return childFramesWithAttributes;
}

async function getStructure(frame) {
    const bodyNode = await frame.locator("body", { timeout: 1000 });
    const bodyHtml = await bodyNode.innerHTML();
    const node = parseFrame(bodyHtml);
    const rootElem = createElement(node);
    await dfs(node, rootElem, await toChildFramesWithAttributes(frame));
    return rootElem;
}

function parseFrame(html) {
    return parse(html, {
        blockTextElements: {
            script: false,
            noscript: false,
            style: false,
            pre: true, // keep text content when parsing
        },
    });
}

export async function parseSite(page) {
    let mainFrame = page.mainFrame();
    const structure = await getStructure(mainFrame);
    return structure.innerHTML;
}

export function removeBlankTags(text) {
    const emptyTagRegex = /<(\w+)([^>]*)><\/\1>|<(\w+)([^>]*)>\s*<\/\3>/g;

    let newText = text;

    while (emptyTagRegex.test(newText)) {
        newText = newText.replace(emptyTagRegex, "");
    }

    return newText;
}
