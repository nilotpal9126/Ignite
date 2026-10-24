import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const context = vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('environment-assets.js',root),'utf8'),context);
const assets=context.window.IgniteEnvironmentAssets;

test('four curated scenes have fixed local artwork, safe references and layer-coordinate annotations',()=>{
  assert.equal(Object.keys(assets).length,4);
  for(const scene of Object.values(assets)) {
    assert.ok(scene.subjects.length);
    assert.equal(new URL(scene.referenceUrl).protocol,'https:');
    assert.ok(scene.labels.length);
    for(const layer of ['macro','mid','micro']) {
      assert.ok(scene[layer].includes('<defs>'));
      assert.doesNotMatch(scene[layer],/<script|foreignObject|\bon[a-z]+\s*=|(?:href|src)=|https?:/i);
      assert.ok(scene.labels.some(label=>label.layer===layer));
    }
    for(const label of scene.labels){assert.ok(label.x>=0&&label.x<=1440);assert.ok(label.y>=0&&label.y<=900);assert.ok(label.detail.length>20);}
  }
});
test('ellipse annotations and drawing satisfy the focal-distance invariant',()=>{
  const scene=assets.geometric_cross_sections;
  const labels=scene.labels.filter(label=>label.layer==='micro');
  const f1=labels.find(label=>label.title==='Focus F₁');
  const p=labels.find(label=>label.title.startsWith('Point P'));
  const a=310,b=175,c=720-f1.x,x=p.x-720,y=p.y-450;
  assert.ok(Math.abs(c*c-(a*a-b*b))<1e-8);
  assert.ok(Math.abs(x*x/(a*a)+y*y/(b*b)-1)<1e-10);
  assert.ok(Math.abs(Math.hypot(x+c,y)+Math.hypot(x-c,y)-2*a)<1e-8);
  assert.ok(scene.micro.includes(`cx="${-c}"`));
});
test('carbon bonding shows four directions without claiming a measured 2D angle or density',()=>{
  const scene=assets.molecular_lattice;
  assert.equal((scene.mid.match(/<line /g)||[]).length,4);
  assert.equal((scene.mid.replace(/<defs>[\s\S]*?<\/defs>/g,'').match(/<circle /g)||[]).length,5);
  assert.match(scene.caption,/projected schematic/);
  assert.match(scene.labels.find(label=>label.layer==='micro').detail,/not a computed/);
  assert.doesNotMatch(scene.mid,/109\.5|hexagonal/);
});
