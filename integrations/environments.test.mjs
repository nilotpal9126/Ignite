import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('environment-assets.js',root),'utf8'),context);
vm.runInContext(readFileSync(new URL('environments.js',root),'utf8'),context);
const assets=context.window.IgniteEnvironmentAssets, camera=context.window.IgniteEnvironmentSystem.cameraAt;
test('only Moon and methane backgrounds remain, each continuous at every depth',()=>{
  assert.deepEqual(Object.keys(assets).sort(),['lunar_surface','molecular_lattice']);
  for(const scene of Object.values(assets)){
    assert.ok(scene.artwork.includes('<defs>'));assert.equal(new URL(scene.referenceUrl).protocol,'https:');
    assert.doesNotMatch(scene.artwork,/<script|foreignObject|\bon[a-z]+\s*=|https?:/i);
    for(const match of scene.artwork.matchAll(/href="([^"]+)"/g))assert.equal(match[1],'./assets/environments/nasa-full-moon.jpg');
    for(const layer of ['macro','mid','micro']){
      assert.equal(scene[layer],scene.artwork);
      assert.ok(scene.labels.some(l=>l.layer===layer));
      const [x,y,w,h]=scene.inspectionViews[layer];assert.ok(w>0&&h>0);
      for(const label of scene.labels.filter(l=>l.layer===layer)){
        assert.ok(label.x>=x&&label.x<=x+w&&label.y>=y&&label.y<=y+h,scene.id+' '+label.title);
        assert.ok(label.detail.length>20);
      }
    }
  }
});
test('continuous cameras hit exact waypoints without switching art or nonpositive zoom',()=>{
  for(const scene of Object.values(assets)){
    for(const [depth,i]of [[0,0],[.55,1],[1,2]]){
      camera(scene,depth).forEach((v,j)=>assert.ok(Math.abs(v-scene.cameras[i][j])<1e-8));
    }
    let previous=camera(scene,0);
    for(let i=1;i<=1000;i++){
      const view=camera(scene,i/1000);
      assert.ok(view.every(Number.isFinite));assert.ok(view[2]>0&&view[3]>0);
      assert.ok(view[2]<=previous[2]+1e-6,'zoom must approach rather than jump backwards');
      assert.ok(Math.abs(Math.log(view[2]/previous[2]))<.03,'no discontinuous cut');
      previous=view;
    }
  }
});
test('four methane directions form an exact regular tetrahedron',()=>{
  const vertices=assets.molecular_lattice.geometry.tetrahedron;
  assert.equal(vertices.length,4);
  vertices.forEach((v,i)=>{
    assert.ok(Math.abs(v.reduce((n,x)=>n+x*x,0)-1)<1e-10);
    vertices.slice(i+1).forEach(w=>assert.ok(Math.abs(v.reduce((n,x,j)=>n+x*w[j],0)+1/3)<1e-10));
  });
  assert.equal((assets.molecular_lattice.artwork.match(/<line /g)||[]).length,4);
  assert.doesNotMatch(assets.molecular_lattice.artwork,/electron-density|orbital/);
});
test('NASA source is locally hosted, unmodified and explicitly credited',()=>{
  assert.equal(readFileSync(new URL('assets/environments/nasa-full-moon.jpg',root)).subarray(0,2).toString('hex'),'ffd8');
  assert.match(readFileSync(new URL('assets/environments/CREDITS.txt',root),'utf8'),/NASA.*Scientific Visualization Studio/);
  assert.match(assets.lunar_surface.caption,/not a live/);
});
