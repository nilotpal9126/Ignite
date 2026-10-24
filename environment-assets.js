'use strict';
// Continuous, source-grounded worlds. A camera approaches the same feature.
(function(root) {
  const f=n=>Number(n.toFixed(3));
  const defs=String.raw`<defs>
    <radialGradient id="carbon" cx="30%" cy="25%"><stop stop-color="#88b8c3"/><stop offset=".65" stop-color="#357184"/><stop offset="1" stop-color="#183e55"/></radialGradient>
    <radialGradient id="hydrogen" cx="30%" cy="25%"><stop stop-color="#fffdf7"/><stop offset=".7" stop-color="#d5e3e5"/><stop offset="1" stop-color="#809ca9"/></radialGradient>
    <linearGradient id="bond"><stop stop-color="#b6cdd2"/><stop offset=".45" stop-color="#eef6f1"/><stop offset="1" stop-color="#668d9b"/></linearGradient>
    <clipPath id="moon-disc"><circle cx="720" cy="450" r="350"/></clipPath>
  </defs>`;
  const moon=defs+'<image href="./assets/environments/nasa-full-moon.jpg" x="310.4" y="40.4" width="819.2" height="819.2" clip-path="url(#moon-disc)"/>';
  const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(v=>v.map(n=>n/Math.sqrt(3)));
  const atoms=tetra.map(([x,y,z])=>{
    const X=x*Math.cos(.55)+z*Math.sin(.55),Z=z*Math.cos(.55)-x*Math.sin(.55);
    return [f(720+270*X),f(450+270*(y*Math.cos(.35)-Z*Math.sin(.35))),Z];
  });
  const front=atoms.reduce((a,b)=>b[0]>a[0]?b:a),bondPoint=[f((720+front[0])/2),f((450+front[1])/2)];
  let bonds='',hydrogen='';
  for(const [x,y,z]of [...atoms].sort((a,b)=>a[2]-b[2])){
    bonds+='<line x1="720" y1="450" x2="'+x+'" y2="'+y+'" stroke="url(#bond)" stroke-width="14" stroke-linecap="round" opacity="'+(z<0?.65:1)+'"/>';
    hydrogen+='<g><circle cx="'+x+'" cy="'+y+'" r="30" fill="url(#hydrogen)" stroke="#78959c" stroke-width="1"/><text x="'+x+'" y="'+(y+7)+'" text-anchor="middle" class="env-atom-h">H</text></g>';
  }
  const methane=defs+bonds+hydrogen+'<circle cx="720" cy="450" r="48" fill="url(#carbon)" stroke="#1e5061"/><text x="720" y="461" text-anchor="middle" class="env-atom-c">C</text><text x="720" y="185" text-anchor="middle" class="env-art-label">CH₄</text>';
  const label=(layer,x,y,pinX,pinY,title,detail)=>({layer,x,y,pinX,pinY,title,detail});
  const scenes={
    lunar_surface:{id:'lunar_surface',title:'The Moon, in detail',subjects:['physics','general'],artwork:moon,
      caption:'NASA SVS · LRO-based visualization · one continuous view, not a live lunar phase',
      referenceUrl:'https://svs.gsfc.nasa.gov/5415/',referenceLabel:'NASA SVS · imagery and credit',credit:'NASA’s Scientific Visualization Studio · Ernie Wright',
      cameras:[[0,0,1440,900],[270,80,900,740],[570,500,420,340]],labels:[
        label('macro',720,450,1070,200,'A complete lunar view','NASA’s visualization uses Lunar Reconnaissance Orbiter terrain and camera data. This is not an invented crater map.'),
        label('mid',625,320,510,230,'Dark maria','The darker plains contrast with the brighter, heavily cratered highlands. The camera retains the same surface features as it approaches.'),
        label('mid',875,490,970,430,'Cratered highlands','Lighter terrain contains many overlapping impact features. No physical measurement is inferred from the display.'),
        label('micro',768,664,845,730,'Bright ray systems','Bright streaks surround some impact craters in the source visualization. This is a crop of the same lunar image, not a substituted sketch.'),
        label('micro',720,580,670,540,'Surface texture','The surrounding terrain remains in the close view. Fine detail is limited by the original image resolution.')]},
    molecular_lattice:{id:'molecular_lattice',title:'Methane, in three dimensions',subjects:['chemistry'],artwork:methane,
      caption:'CH₄ · exact tetrahedral directions in a projected model · atom sizes not to scale',
      referenceUrl:'https://openstax.org/books/organic-chemistry/pages/1-6-sp3-hybrid-orbitals-and-the-structure-of-methane',referenceLabel:'OpenStax · tetrahedral methane',
      geometry:{tetrahedron:tetra},cameras:[[0,0,1440,900],[350,170,740,560],[650,370,420,310]],labels:[
        label('macro',720,450,1080,270,'One complete CH₄ molecule','One carbon connects to four hydrogens. Four rods represent its chemical bonds.'),
        label('mid',720,450,720,235,'Four equivalent directions','Bond directions are computed from a regular tetrahedron. Its 3D bond angle is about 109.5 degrees; projected screen angles differ.'),
        label('micro',720,450,695,405,'Carbon centre','The coloured sphere identifies carbon. Its shading conveys model depth, not a measured atomic surface.'),
        label('micro',bondPoint[0],bondPoint[1],835,620,'A C–H covalent bond','The rod represents a shared-electron bond. It is a model convention, not a literal rod or computed electron-density cloud.'),
        label('micro',front[0],front[1],1000,450,'Hydrogen','The lighter sphere is one of four hydrogen atoms. All bonds belong to the same model throughout the camera movement.')]},

  };
  for(const scene of Object.values(scenes)){
    scene.macro=scene.mid=scene.micro=scene.artwork;
    scene.inspectionViews=Object.freeze(Object.fromEntries(['macro','mid','micro'].map((layer,i)=>[layer,Object.freeze(scene.cameras[i])])));
    Object.freeze(scene.cameras);Object.freeze(scene.subjects);scene.labels=Object.freeze(scene.labels.map(Object.freeze));Object.freeze(scene);
  }
  root.IgniteEnvironmentAssets=Object.freeze(scenes);
})(typeof window==='undefined'?globalThis:window);
