import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const jsonnetPath = path.resolve('JS/edgechains/arakoodev/examples/palm2/prompt.jsonnet');

function loadPromptFromJsonnet(filePath, key = 'prompt') {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return parsed[key];
}

test('loads prompt from prompt.jsonnet (not hardcoded) and invokes PaLM 2 generateText', async () => {
    const promptText = loadPromptFromJsonnet(jsonnetPath, 'prompt');
    assert.ok(promptText.includes('EdgeChains'));

    let capturedUrl = '';
    let capturedBody = null;
    const transport = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
            candidates: [{ output: 'EdgeChains declaratively orchestrates LLM prompts via Jsonnet.' }],
        };
    };

    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta2';
    const res = await transport(`${baseUrl}/models/text-bison-001:generateText?key=test_key`, {
        prompt: { text: promptText },
        temperature: 0.3,
    });

    assert.ok(capturedUrl.includes('models/text-bison-001:generateText'));
    assert.equal(capturedBody.prompt.text, promptText);
    assert.equal(res.candidates[0].output, 'EdgeChains declaratively orchestrates LLM prompts via Jsonnet.');
});

test('loads chatContext and chatQuestion from prompt.jsonnet for PaLM 2 chat-bison-001', async () => {
    const context = loadPromptFromJsonnet(jsonnetPath, 'chatContext');
    const question = loadPromptFromJsonnet(jsonnetPath, 'chatQuestion');
    assert.ok(context.length > 10);
    assert.ok(question.includes('EdgeChains'));
});
