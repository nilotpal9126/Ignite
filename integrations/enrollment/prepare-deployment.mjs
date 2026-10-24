import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ownDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(ownDirectory, '../..');
const publicFiles = ['enrollment-config.js', 'enrollment-validation.js', 'enrollment.css', 'enrollment.js',
  'firebase-session.js', 'account-ui.js', 'account.css', 'trial-diagrams.js',
  'environment-assets.js', 'environments.js', 'environments.css',
  'assets/environments/nasa-full-moon.jpg','assets/environments/CREDITS.txt'];
const safeStaticPath = /^(?:[^/]+\.(?:html|css|js)|labs-manifest\.json|labs\/[A-Za-z0-9_./-]+\.(?:html|css|js)|(?:assets|data|game)\/[^\r\n]+\.(?:js|json|jpg|png|webp|svg|woff2|txt))$/i;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function inspectConfiguration(root) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(await readFile(path.join(root, 'enrollment-config.js'), 'utf8'), context, { timeout: 1000 });
  const config = context.window.__IGNITE_ENROLLMENT__ || {};
  const missing = [];
  let endpoint;
  try { endpoint = new URL(config.endpointUrl); } catch {}
  if (!endpoint || endpoint.protocol !== 'https:' || endpoint.pathname !== '/enrollments'
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || /(?:\.invalid|\.example|\.test|example\.com|localhost)$/.test(endpoint.hostname)) missing.push('production endpointUrl');
  if (typeof config.turnstileSiteKey !== 'string' || !/^0x[A-Za-z0-9_-]{10,100}$/.test(config.turnstileSiteKey)
    || /^1x00000000000000000000AA$/.test(config.turnstileSiteKey)) missing.push('production turnstileSiteKey');
  let identity = {};
  try {
    vm.runInContext(await readFile(path.join(root, 'platform-config.js'), 'utf8'), context, { timeout: 1000 });
    identity = context.window.__IGNITE_PLATFORM__?.identity || {};
  } catch { /* Missing Firebase configuration is reported separately from Sheet configuration. */ }
  const firebaseConfigurationReady = Boolean(identity.enabled && identity.provider === 'firebase'
    && identity.apiKey && identity.projectId && identity.authDomain && identity.appId);
  return { publicConfigurationReady: missing.length === 0, missing,
    storageDeploymentVerified: false, firebaseConfigurationReady, firebaseDeploymentVerified: false,
    studentAuthentication: firebaseConfigurationReady ? 'firebase-email-password' : 'not_configured' };
}

export async function prepareDeployment({ root = defaultRoot, output, files } = {}) {
  if (!output) throw new Error('Provide --out with a new deployment directory.');
  root = path.resolve(root);
  output = path.resolve(output);
  if (output === root || root.startsWith(output + path.sep)) throw new Error('The output must not contain or replace the source repository.');
  try {
    await mkdir(output); // Refuse an existing target, including an old deployment bundle.
  } catch (error) {
    throw new Error(`Choose a new output directory; existing output is never overwritten (${error.code}).`);
  }
  const tracked = files || execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  // release.json is generated below; never copy/hash the previous release into itself.
  const labsFiles = [];
  let labsManifest;
  try { labsManifest = JSON.parse(await readFile(path.join(root, 'labs-manifest.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (labsManifest) {
    if (labsManifest.schemaVersion !== 'ignite-labs/1' || !Array.isArray(labsManifest.files)
      || labsManifest.files.some(file => typeof file !== 'string' || !file.startsWith('labs/') || file.split('/').some(part => part === '..') || !safeStaticPath.test(file))) throw new Error('Invalid labs manifest.');
    labsFiles.push('labs-manifest.json', 'labs.html', 'labs.css', 'labs.js', 'labs-registry.js', 'lab-context.js', 'studios-link.js', ...labsManifest.files);
  }
  const candidates = [...new Set([...tracked, ...publicFiles, ...labsFiles])].filter(file => safeStaticPath.test(file) && file !== 'release.json');
  const checksums = {};
  const put = async (relative, bytes) => {
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    checksums[relative.replaceAll('\\', '/')] = digest(bytes);
  };
  for (const file of candidates) {
    const source = path.resolve(root, file);
    if (!source.startsWith(root + path.sep)) throw new Error('Invalid source path.');
    await put(`website/${file}`, await readFile(source));
  }
  // Validate local HTML resources rather than relying on a successful copy alone.
  const publicSet = new Set(candidates.map(file => file.toLowerCase()));
  for (const file of candidates.filter(file => file.endsWith('.html'))) {
    const html = await readFile(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["'](\.\/[^"'#?]+)(?:[?#][^"']*)?["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      if (!publicSet.has(target.toLowerCase())) throw new Error(`Missing website resource: ${file} -> ${target}`);
    }
  }
  const readiness = await inspectConfiguration(root);
  const generatedAt = new Date().toISOString();
  const websiteHashes = Object.fromEntries(Object.entries(checksums).map(([file, hash]) => [file.slice('website/'.length), hash]));
  await put('website/release.json', JSON.stringify({
    schemaVersion: 'ignite-public-release/1', releaseId: 'ignite-enrollment-' + generatedAt.replace(/[^0-9]/g, ''),
    builtAt: generatedAt, mode: 'sample_preview', admissions: 'paused',
    enquiries: readiness.publicConfigurationReady ? 'configured_pending_live_check' : 'not_configured',
    studentAuthentication: readiness.studentAuthentication, firebaseConfigurationReady: readiness.firebaseConfigurationReady,
    pendingAssessmentBanksIncluded: false, files: websiteHashes,
  }, null, 2) + '\n');
  const integration = path.join(root, 'integrations/enrollment');
  const rules = await readFile(path.join(root, 'enrollment-validation.js'));
  await put('apps-script/Rules.gs', rules);
  await put('apps-script/Code.gs', await readFile(path.join(integration, 'Code.gs')));
  await put('apps-script/appsscript.json', await readFile(path.join(integration, 'appsscript.json')));
  await put('cloudflare/enrollment-validation.js', rules);
  const worker = (await readFile(path.join(integration, 'worker.mjs'), 'utf8'))
    .replace("import '../../enrollment-validation.js';", "import './enrollment-validation.js';");
  await put('cloudflare/worker.mjs', worker);
  await put('cloudflare/wrangler.jsonc', await readFile(path.join(integration, 'wrangler.jsonc')));
  await put('cloudflare/.dev.vars.example', await readFile(path.join(integration, '.dev.vars.example')));
  await put('DEPLOYMENT.md', await readFile(path.join(integration, 'DEPLOYMENT.md')));
  await put('FIREBASE.md', await readFile(path.join(root, 'integrations/firebase/README.md')));
  const release = { schemaVersion: 'ignite-enrollment-deployment/1', generatedAt,
    ...readiness, serverSecretsIncluded: false, files: checksums };
  await writeFile(path.join(output, 'deployment-manifest.json'), JSON.stringify(release, null, 2) + '\n');
  return { output, websiteFiles: candidates.length + 1, artifactFiles: Object.keys(checksums).length,
    sharedValidationSha256: digest(rules), ...readiness };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  try {
    const rootIndex = args.indexOf('--root');
    const root = rootIndex === -1 ? defaultRoot : args[rootIndex + 1];
    if (args.includes('--check-config')) {
      const status = await inspectConfiguration(root);
      console.log(JSON.stringify(status, null, 2));
      if (!status.publicConfigurationReady) process.exitCode = 1;
    } else {
      const outIndex = args.indexOf('--out');
      console.log(JSON.stringify(await prepareDeployment({ root, output: outIndex === -1 ? undefined : args[outIndex + 1] }), null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
