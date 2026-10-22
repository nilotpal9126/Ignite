import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareDeployment, inspectConfiguration } from './prepare-deployment.mjs';

const source = path.dirname(fileURLToPath(import.meta.url));
async function fixture() {
  const temp = await mkdtemp(path.join(tmpdir(), 'ignite-deployment-test-'));
  const root = path.join(temp, 'source');
  await mkdir(path.join(root, 'integrations/enrollment'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<link rel="stylesheet" href="./enrollment.css"><script src="./enrollment.js"></script>');
  for (const file of ['enrollment-config.js', 'enrollment-validation.js', 'enrollment.css', 'enrollment.js', 'firebase-session.js', 'account-ui.js', 'account.css', 'trial-diagrams.js']) {
    await copyFile(path.resolve(source, '../..', file), path.join(root, file));
  }
  for (const file of ['Code.gs', 'appsscript.json', 'worker.mjs', 'wrangler.jsonc', '.dev.vars.example', 'DEPLOYMENT.md']) {
    await copyFile(path.join(source, file), path.join(root, 'integrations/enrollment', file));
  }
  await mkdir(path.join(root, 'integrations/firebase'), { recursive: true });
  await copyFile(path.resolve(source, '../firebase/README.md'), path.join(root, 'integrations/firebase/README.md'));
  await writeFile(path.join(root, 'platform-config.js'), "window.__IGNITE_PLATFORM__={identity:{enabled:true,provider:'firebase',apiKey:'synthetic-key',projectId:'synthetic-project',authDomain:'synthetic.firebaseapp.com',appId:'synthetic-app'}};");
  await writeFile(path.join(root, '.env'), 'DO_NOT_PUBLISH=synthetic-private-value');
  return { root, output: path.join(temp, 'deployment') };
}

test('deployment generator separates website and servers, copies identical rules and refuses overwrites', async () => {
  const input = await fixture();
  const result = await prepareDeployment({ ...input, files: ['index.html', '.env', 'integrations/enrollment/Code.gs'] });
  assert.equal(result.publicConfigurationReady, false);
  const site = await readdir(path.join(input.output, 'website'));
  assert.equal(site.includes('.env'), false);
  assert.equal(site.includes('integrations'), false);
  const clientRules = await readFile(path.join(input.output, 'website/enrollment-validation.js'), 'utf8');
  assert.equal(await readFile(path.join(input.output, 'apps-script/Rules.gs'), 'utf8'), clientRules);
  assert.equal(await readFile(path.join(input.output, 'cloudflare/enrollment-validation.js'), 'utf8'), clientRules);
  assert.match(await readFile(path.join(input.output, 'cloudflare/worker.mjs'), 'utf8'), /import '\.\/enrollment-validation\.js'/);
  const manifest = JSON.parse(await readFile(path.join(input.output, 'deployment-manifest.json'), 'utf8'));
  const siteRelease = JSON.parse(await readFile(path.join(input.output, 'website/release.json'), 'utf8'));
  assert.equal(siteRelease.enquiries, 'not_configured');
  assert.equal(siteRelease.files['enrollment.js'], manifest.files['website/enrollment.js']);
  assert.equal(manifest.serverSecretsIncluded, false);
  assert.equal(manifest.studentAuthentication, 'firebase-email-password');
  assert.equal(manifest.firebaseConfigurationReady, true);
  assert.ok(Object.values(manifest.files).every(hash => /^[0-9a-f]{64}$/.test(hash)));
  await assert.rejects(() => prepareDeployment({ ...input, files: ['index.html'] }), /existing output is never overwritten/);
});

test('configuration check catches incomplete public settings and accepts a production-shaped pair without claiming live verification', async () => {
  const { root } = await fixture();
  assert.equal((await inspectConfiguration(root)).missing.length, 2);
  await writeFile(path.join(root, 'enrollment-config.js'), "window.__IGNITE_ENROLLMENT__={endpointUrl:'https://enrollment.company.org/enrollments',turnstileSiteKey:'0xSyntheticSiteKey123456'};");
  const result = await inspectConfiguration(root);
  assert.equal(result.publicConfigurationReady, true);
  assert.equal(result.storageDeploymentVerified, false);
  await writeFile(path.join(root, 'enrollment-config.js'), "window.__IGNITE_ENROLLMENT__={endpointUrl:'https://example.invalid/enrollments',turnstileSiteKey:'0xSyntheticSiteKey123456'};");
  assert.equal((await inspectConfiguration(root)).publicConfigurationReady, false);
});

test('deployment check fails when an HTML resource is missing', async () => {
  const input = await fixture();
  await writeFile(path.join(input.root, 'index.html'), '<script src="./missing.js"></script>');
  await assert.rejects(() => prepareDeployment({ ...input, files: ['index.html'] }), /Missing website resource/);
});
