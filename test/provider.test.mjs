import { describe, it, before, after } from 'node:test';
import { providerArgv, providerName, providerTimeoutMs, resolveProvider } from '../engine/tools/shared.mjs';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const spaced = 'C:/my books/page.json';
assert.deepStrictEqual(providerArgv('claude -p {promptFile}', spaced), ['claude', '-p', spaced]);
assert.deepStrictEqual(providerArgv('agent --in "{promptFile}" --json', spaced), ['agent', '--in', spaced, '--json']);
assert.deepStrictEqual(providerArgv('my-agent --flag', spaced), ['my-agent', '--flag']);
assert.deepStrictEqual(providerArgv('claude {promptFile} {promptFile}', spaced), ['claude', spaced, spaced]);
assert.strictEqual(providerName('claude -p x'), 'claude');
assert.strictEqual(providerName(null), null);

delete process.env.PREP_PROVIDER;
assert.strictEqual(resolveProvider(), null);
process.env.PREP_PROVIDER = '   ';
assert.strictEqual(resolveProvider(), null, 'blank provider should be treated as unset');
process.env.PREP_PROVIDER = '  claude -p {promptFile}  ';
assert.strictEqual(resolveProvider(), 'claude -p {promptFile}', 'provider should be trimmed');

delete process.env.PREP_TIMEOUT;
assert.strictEqual(providerTimeoutMs(), 300000, 'default timeout');
process.env.PREP_TIMEOUT = '5000';
assert.strictEqual(providerTimeoutMs(), 5000);
process.env.PREP_TIMEOUT = 'nonsense';
assert.strictEqual(providerTimeoutMs(), 300000, 'bad timeout falls back to default');
delete process.env.PREP_PROVIDER;
delete process.env.PREP_TIMEOUT;

/**
 * End-to-end check that PREP_PROVIDER is really spawned and that the response
 * file it writes is picked up. The stub is created in a temp directory and
 * removed afterwards, so nothing is left behind in the repo.
 */
describe('PREP_PROVIDER end-to-end', () => {
  const originalProvider = process.env.PREP_PROVIDER;
  let tmp;

  before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-agent-')); });
  after(() => {
    if (originalProvider === undefined) delete process.env.PREP_PROVIDER;
    else process.env.PREP_PROVIDER = originalProvider;
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('runs the provider and reads the response file it writes', async () => {
    const stub = path.join(tmp, 'stub.mjs');
    fs.writeFileSync(stub, [
      "import fs from 'node:fs';",
      'const promptFile = process.argv[2];',
      'const responseFile = promptFile.replace(/-prompt\\.json$/, "-response.json");',
      'fs.writeFileSync(responseFile, JSON.stringify({',
      '  title: "Stub Title",',
      '  subtitle: "Written by the stub agent",',
      '  explainerHtml: "<p>Body from the agent.</p>",',
      '  actionLabel: "TRY THIS",',
      '  actionContent: "Do the thing.",',
      '  imageType: "diagram",',
      '  imagePrompt: "A diagram",',
      '  wordCount: 4',
      '}));',
    ].join('\n'));

    const promptFile = path.join(tmp, 'page-001-prompt.json');
    const responseFile = path.join(tmp, 'page-001-response.json');
    fs.writeFileSync(promptFile, JSON.stringify({ page: { no: 1, title: 'X' } }));

    process.env.PREP_PROVIDER = `node ${stub} {promptFile}`;
    const { getProposal } = await import('../engine/tools/prep-pages.mjs');

    const response = await getProposal(resolveProvider(), promptFile, responseFile, 'stub');

    assert.ok(response, 'provider should have produced a response');
    assert.strictEqual(response.title, 'Stub Title');
    assert.strictEqual(response.subtitle, 'Written by the stub agent');
    assert.ok(!fs.existsSync(responseFile), 'response file should be consumed, not left behind');
  });

  it('returns null when the provider writes nothing', async () => {
    const stub = path.join(tmp, 'silent.mjs');
    fs.writeFileSync(stub, 'process.exit(0);\n');

    const promptFile = path.join(tmp, 'page-002-prompt.json');
    const responseFile = path.join(tmp, 'page-002-response.json');
    fs.writeFileSync(promptFile, JSON.stringify({ page: { no: 2, title: 'Y' } }));

    process.env.PREP_PROVIDER = `node ${stub} {promptFile}`;
    const { getProposal } = await import('../engine/tools/prep-pages.mjs');

    const response = await getProposal(resolveProvider(), promptFile, responseFile, 'stub');
    assert.strictEqual(response, null, 'a silent provider must not hang or fabricate a result');
  });

  it('gives up on a hung provider instead of waiting forever', async () => {
    const stub = path.join(tmp, 'hang.mjs');
    fs.writeFileSync(stub, 'setInterval(() => {}, 1000);\n');

    const promptFile = path.join(tmp, 'page-003-prompt.json');
    const responseFile = path.join(tmp, 'page-003-response.json');
    fs.writeFileSync(promptFile, JSON.stringify({ page: { no: 3, title: 'Z' } }));

    process.env.PREP_PROVIDER = `node ${stub} {promptFile}`;
    process.env.PREP_TIMEOUT = '1200';
    const { getProposal } = await import('../engine/tools/prep-pages.mjs');

    const started = Date.now();
    const response = await getProposal(resolveProvider(), promptFile, responseFile, 'stub');
    const elapsed = Date.now() - started;

    assert.strictEqual(response, null);
    assert.ok(elapsed < 20000, `should have stopped near the 1200ms guard, took ${elapsed}ms`);
    delete process.env.PREP_TIMEOUT;
  });
});