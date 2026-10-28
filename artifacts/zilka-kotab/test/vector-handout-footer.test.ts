import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { finishSnapshotWithVectorFooter } from '../src/components/ai-tools/vector-handout-footer';
import { EXAMINER_QUESTIONS } from '../src/components/ai-tools/snapshot-questions';

test('portfolio and examiner handouts use the same one-page native vector footer', async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const uri = String(input);
    assert.ok(uri.endsWith('firm-handout-footer.pdf'));
    const bytes = await readFile(fileURLToPath(uri));
    return new Response(new Uint8Array(bytes), { status: 200 });
  };
  try {
    const outputDirectory = fileURLToPath(new URL('../../../generated-artifacts/', import.meta.url));
    await mkdir(outputDirectory, { recursive: true });
    for (const [kind, questions] of [['portfolio', undefined], ['examiner', EXAMINER_QUESTIONS]] as const) {
      const source = new jsPDF({ unit: 'pt', format: 'letter' });
      source.text(`Sample ${kind} metrics`, 36, 80);
      const blob = await finishSnapshotWithVectorFooter(source, questions);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const document = await PDFDocument.load(bytes);
      assert.equal(document.getPageCount(), 1);
      assert.deepEqual(document.getPage(0).getSize(), { width: 612, height: 792 });
      await writeFile(`${outputDirectory}/${kind}-vector-footer-check.pdf`, bytes);
    }
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
