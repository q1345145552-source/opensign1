import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const backendRoot = path.resolve(import.meta.dirname, '..');
const approvedLogoHash =
  'b3fbb0b3962ea058885708cd55da03f7baa5d5bd89e2999cb8504f31d6c94cb2';

test('certificate uses the approved Xiangtai logo', () => {
  const logoPath = path.join(backendRoot, 'images/logo.png');
  const hash = createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex');
  assert.equal(hash, approvedLogoHash);
});

test('certificate keeps the square Xiangtai logo aspect ratio', () => {
  const source = fs.readFileSync(
    path.join(backendRoot, 'cloud/parsefunction/pdf/GenerateCertificate.js'),
    'utf8'
  );
  assert.match(source, /page\.drawImage\(pngImage,[\s\S]*?width:\s*50,[\s\S]*?height:\s*50/u);
});

test('backend email content no longer loads the legacy hosted logo', () => {
  const sourcePaths = [
    'Utils.js',
    'cloud/parsefunction/ForwardDoc.js',
    'cloud/parsefunction/declinedocument.js',
    'cloud/parsefunction/pdf/PDF.js',
  ];

  for (const sourcePath of sourcePaths) {
    const source = fs.readFileSync(path.join(backendRoot, sourcePath), 'utf8');
    assert.doesNotMatch(
      source,
      /qikinnovation\.ams3\.digitaloceanspaces\.com\/logo\.png/iu,
      `legacy hosted logo in backend email content: ${sourcePath}`
    );
    assert.match(
      source,
      /xiangtai-logo\.png|brandLogoUrl/u,
      `missing Xiangtai logo in backend email content: ${sourcePath}`
    );
  }
});
