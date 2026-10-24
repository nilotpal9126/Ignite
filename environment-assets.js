'use strict';
// Continuous, source-grounded worlds. A camera approaches the same feature.
(function(root) {
  const f=n=>Number(n.toFixed(3)),poly=pts=>pts.map((p,i)=>(i?'L':'M')+p.map(f).join(',')).join(' ')+'Z';
  const defs=String.raw`<defs>
    <radialGradient id="leaf-wash" cx="35%" cy="35%"><stop stop-color="#e2ecd4"/><stop offset="1" stop-color="#94b69a"/></radialGradient>
    <radialGradient id="epidermal-surface"><stop offset="0" stop-color="#dbe5c8"/><stop offset=".65" stop-color="#dbe5c8"/><stop offset="1" stop-color="#dbe5c8" stop-opacity="0"/></radialGradient>
    <radialGradient id="carbon" cx="30%" cy="25%"><stop stop-color="#88b8c3"/><stop offset=".65" stop-color="#357184"/><stop offset="1" stop-color="#183e55"/></radialGradient>
    <radialGradient id="hydrogen" cx="30%" cy="25%"><stop stop-color="#fffdf7"/><stop offset=".7" stop-color="#d5e3e5"/><stop offset="1" stop-color="#809ca9"/></radialGradient>
    <linearGradient id="bond"><stop stop-color="#b6cdd2"/><stop offset=".45" stop-color="#eef6f1"/><stop offset="1" stop-color="#668d9b"/></linearGradient>
    <clipPath id="moon-disc"><circle cx="720" cy="450" r="350"/></clipPath>
    <clipPath id="leaf-edge"><path d="M440 770C350 400 700 135 1070 125C1090 480 820 765 440 770Z"/></clipPath>
  </defs>`;
  const moon=defs+'<image href="./assets/environments/nasa-full-moon.jpg" x="310.4" y="40.4" width="819.2" height="819.2" clip-path="url(#moon-disc)"/><circle cx="720" cy="450" r="351" fill="none" stroke="#526c7b" stroke-width=".8"/>';
  let veins='',walls='',stomata='';
  for(let i=1;i<=12;i++){
    const t=i/14,x=440+630*t,y=770-645*t;
    veins+='<path d="M'+f(x)+' '+f(y)+'Q'+f(x-105)+' '+f(y-125)+' '+f(x-100+80*t)+' '+f(y-230+90*t)+'M'+f(x)+' '+f(y)+'Q'+f(x+125)+' '+f(y+48)+' '+f(x+235-115*t)+' '+f(y+25)+'" class="env-vein"/>';
    for(let j=1;j<=4;j++)veins+='<path d="M'+f(x-24*j)+' '+f(y-30*j)+'q-32 -12 -58 -5M'+f(x+26*j)+' '+f(y+8*j)+'q24 -27 23 -53" class="env-vein fine"/>';
  }
  const point=(i,j)=>[690+i*32+4*Math.sin(j*1.7+i),400+j*28+4*Math.cos(i*1.3+j)];
  for(let j=0;j<10;j++)for(let i=0;i<12;i++)for(const [di,dj]of [[1,0],[0,1]]){
    const [x,y]=point(i,j),[a,b]=point(i+di,j+dj),dx=a-x,dy=b-y;
    walls+='<path d="M'+f(x)+' '+f(y)+'C'+f(x+dx*.33-dy*.12)+' '+f(y+dy*.33+dx*.12)+' '+f(x+dx*.66+dy*.12)+' '+f(y+dy*.66-dx*.12)+' '+f(a)+' '+f(b)+'"/>';
  }
  function stoma(x,y,s=1){
    let organelles='';
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const a=-1.1+i*.55,cx=side*(9+3*Math.cos(a)),cy=13*Math.sin(a);
      organelles+='<ellipse cx="'+f(cx)+'" cy="'+f(cy)+'" rx="1.7" ry="1.05" fill="#467c58" opacity=".8"/>';
    }
    return '<g transform="translate('+x+' '+y+') scale('+s+')" class="env-stoma"><path d="M0 -19C-22 -21 -23 21 0 19C-8 9 -8 -9 0 -19Z" fill="#b6cf9d"/><path d="M0 -19C22 -21 23 21 0 19C8 9 8 -9 0 -19Z" fill="#c9dcaf"/><path d="M0 -17C-6 -5 -6 5 0 17C6 5 6 -5 0 -17Z" fill="#faf7e9"/><path d="M0 -19C-8 -9 -8 9 0 19M0 -19C8 -9 8 9 0 19" fill="none" stroke-width=".9"/>'+organelles+'<ellipse cx="-12" cy="2" rx="2.2" ry="3" fill="#76966b"/><ellipse cx="12" cy="2" rx="2.2" ry="3" fill="#76966b"/></g>';
  }
  for(const [x,y,s]of [[860,530,1],[750,470,.65],[958,475,.7],[775,603,.65],[945,605,.75]])stomata+=stoma(x,y,s);
  const leaf=defs+'<path d="M440 770C350 400 700 135 1070 125C1090 480 820 765 440 770Z" fill="url(#leaf-wash)" stroke="#3b655b" stroke-width="2"/><g clip-path="url(#leaf-edge)"><path d="M425 790Q730 420 1070 125" fill="none" stroke="#6d8c65" stroke-width="8"/>'+veins+'<ellipse cx="850" cy="530" rx="220" ry="150" fill="url(#epidermal-surface)"/><g class="env-epidermis">'+walls+'</g>'+stomata+'</g><path d="M420 810L455 755" stroke="#6d8c65" stroke-width="10" stroke-linecap="round"/>';
  const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(v=>v.map(n=>n/Math.sqrt(3)));
  const atoms=tetra.map(([x,y,z])=>{
    const X=x*Math.cos(.55)+z*Math.sin(.55),Z=z*Math.cos(.55)-x*Math.sin(.55);
    return [f(720+270*X),f(450+270*(y*Math.cos(.35)-Z*Math.sin(.35))),Z];
  });
  const front=atoms.reduce((a,b)=>b[0]>a[0]?b:a),bondPoint=[f((720+front[0])/2),f((450+front[1])/2)];
  let cage='',bonds='',hydrogen='';
  atoms.forEach((p,i)=>atoms.slice(i+1).forEach(q=>{cage+='<path d="M'+p[0]+' '+p[1]+'L'+q[0]+' '+q[1]+'"/>';}));
  for(const [x,y,z]of [...atoms].sort((a,b)=>a[2]-b[2])){
    bonds+='<line x1="720" y1="450" x2="'+x+'" y2="'+y+'" stroke="url(#bond)" stroke-width="14" stroke-linecap="round" opacity="'+(z<0?.65:1)+'"/>';
    hydrogen+='<g><circle cx="'+x+'" cy="'+y+'" r="30" fill="url(#hydrogen)" stroke="#78959c" stroke-width="1"/><text x="'+x+'" y="'+(y+7)+'" text-anchor="middle" class="env-atom-h">H</text></g>';
  }
  const methane=defs+'<g class="env-tetra-cage">'+cage+'</g>'+bonds+hydrogen+'<circle cx="720" cy="450" r="48" fill="url(#carbon)" stroke="#1e5061"/><text x="720" y="461" text-anchor="middle" class="env-atom-c">C</text><text x="720" y="185" text-anchor="middle" class="env-art-label">CH₄</text>';
  // Points satisfy x²+y²=r² and z=kx. The true-view inset uses its own axes.
  const radius=180,k=.62,P=([x,y,z])=>[720+.95*x+.36*y,440+.35*y-.88*z];
  const ring=z=>Array.from({length:121},(_,i)=>P([radius*Math.cos(i*Math.PI/60),radius*Math.sin(i*Math.PI/60),z]));
  const section=Array.from({length:121},(_,i)=>{const t=i*Math.PI/60,x=radius*Math.cos(t);return [x,radius*Math.sin(t),k*x];});
  let meridians='',planeGrid='';
  for(let i=0;i<18;i++){const t=i*Math.PI/9,x=radius*Math.cos(t),y=radius*Math.sin(t);meridians+='<path d="'+poly([P([x,y,-220]),P([x,y,220])]).replace(/Z$/,'')+'" class="line-fine"/>';}
  for(let i=-240;i<=240;i+=60)planeGrid+='<path d="'+poly([P([i,-240,k*i]),P([i,240,k*i])]).replace(/Z$/,'')+'M'+P([-240,i,-240*k]).map(f)+'L'+P([240,i,240*k]).map(f)+'" class="line-fine"/>';
  const a=radius*Math.sqrt(1+k*k)*.75,b=radius*.75,c=Math.sqrt(a*a-b*b),px=60,py=-b*Math.sqrt(1-px*px/(a*a)),ellipse={a,b,c,px,py,cx:1100,cy:450};
  const geometry=defs+'<path d="'+poly(ring(-220))+'" class="line-secondary" fill="#e4dced33"/>'+meridians+'<path d="'+poly(ring(220))+'" class="line-primary"/><path d="'+poly([P([-240,-240,-240*k]),P([240,-240,240*k]),P([240,240,240*k]),P([-240,240,-240*k])])+'" fill="#b8a4d033" stroke="#9476a9" stroke-width="1"/>'+planeGrid+'<path d="'+poly(section.map(P))+'" fill="#b299d04d" stroke="#76538c" stroke-width="2.5"/><path d="M780 450L910 450" class="line-secondary"/><g transform="translate(1100 450)"><ellipse rx="'+a+'" ry="'+b+'" fill="#dacee84d" stroke="#76538c" stroke-width="1.7"/><path d="M'+(-a-25)+' 0H'+(a+25)+'M0 '+(-b-25)+'V'+(b+25)+'" class="line-secondary"/><path d="M'+(-c)+' 0L'+px+' '+py+'L'+c+' 0" stroke="#836399" fill="none" stroke-width="1.2"/><circle cx="'+(-c)+'" cy="0" r="4" fill="#76538c"/><circle cx="'+c+'" cy="0" r="4" fill="#76538c"/><circle cx="'+px+'" cy="'+py+'" r="4" fill="#76538c"/><text x="'+(-c-10)+'" y="21" class="env-art-label tiny">F₁</text><text x="'+(c-8)+'" y="21" class="env-art-label tiny">F₂</text><text x="'+(px+10)+'" y="'+(py-7)+'" class="env-art-label tiny">P</text><text x="0" y="'+(b+46)+'" text-anchor="middle" class="env-art-label tiny">PF₁ + PF₂ = 2a</text><text x="0" y="'+(-b-40)+'" text-anchor="middle" class="env-art-label tiny">TRUE VIEW IN THE CUTTING PLANE</text></g>';
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
    leaf_to_cell:{id:'leaf_to_cell',title:'A leaf, into its surface',subjects:['biology'],artwork:leaf,
      caption:'Original botanical illustration · whole leaf to lower epidermis · schematic, not a micrograph',
      referenceUrl:'https://openstax.org/books/biology-2e/pages/30-4-leaves',referenceLabel:'OpenStax · leaf anatomy',
      cameras:[[0,0,1440,900],[700,420,330,245],[830,507,60,46]],labels:[
        label('macro',700,460,515,320,'Lamina and branching veins','A complete leaf blade surrounds its midrib and branching veins. The smaller surface structures already exist in this same illustration.'),
        label('mid',780,490,750,455,'Epidermal cell walls','Connected, irregular walls outline the epidermal surface. This lower-surface view is stylized, not a species-specific specimen.'),
        label('mid',860,530,950,580,'A stomatal apparatus','The camera approaches this same pair of guard cells. Neighbouring stomata remain as context between scales.'),
        label('micro',850,530,837,519,'Guard cells','Paired, curved guard cells surround the pore. They remain distinct from neighbouring epidermal cell walls.'),
        label('micro',860,530,860,547,'Stomatal pore','The opening between the guard cells permits gas exchange and water-vapour loss. Its drawn shape is schematic.'),
        label('micro',871,520,881,513,'Chloroplasts','Small green bodies represent chloroplasts inside the guard cells. The drawing does not claim a measured organelle size.')]},
    molecular_lattice:{id:'molecular_lattice',title:'Methane, in three dimensions',subjects:['chemistry'],artwork:methane,
      caption:'CH₄ · exact tetrahedral directions in a projected model · atom sizes not to scale',
      referenceUrl:'https://openstax.org/books/organic-chemistry/pages/1-6-sp3-hybrid-orbitals-and-the-structure-of-methane',referenceLabel:'OpenStax · tetrahedral methane',
      geometry:{tetrahedron:tetra},cameras:[[0,0,1440,900],[350,170,740,560],[650,370,420,310]],labels:[
        label('macro',720,450,1080,270,'One complete CH₄ molecule','One carbon connects to four hydrogens. The fine cage joins a regular tetrahedron’s corners; those cage edges are not additional chemical bonds.'),
        label('mid',720,450,720,235,'Four equivalent directions','Bond directions are computed from a regular tetrahedron. Its 3D bond angle is about 109.5 degrees; projected screen angles differ.'),
        label('micro',720,450,695,405,'Carbon centre','The coloured sphere identifies carbon. Its shading conveys model depth, not a measured atomic surface.'),
        label('micro',bondPoint[0],bondPoint[1],835,620,'A C–H covalent bond','The rod represents a shared-electron bond. It is a model convention, not a literal rod or computed electron-density cloud.'),
        label('micro',front[0],front[1],1000,450,'Hydrogen','The lighter sphere is one of four hydrogen atoms. All bonds belong to the same model throughout the camera movement.')]},
    geometric_cross_sections:{id:'geometric_cross_sections',title:'A cylinder, a cut, an ellipse',subjects:['mathematics'],artwork:geometry,
      caption:'Analytically constructed cylinder–plane intersection · connected true-view inset',
      referenceUrl:'https://openstax.org/books/precalculus-2e/pages/10-1-the-ellipse',referenceLabel:'OpenStax · the ellipse',
      geometry:{ellipse,cylinderRadius:radius,planeSlope:k,section},cameras:[[250,80,1150,760],[430,170,900,610],[870,240,460,430]],labels:[
        label('macro',720,440,470,240,'Complete cylinder and cutting plane','The translucent plane crosses a right circular cylinder. Their intersection is computed from both equations, not drawn as an unrelated oval.'),
        label('mid',760,420,860,270,'The actual intersection','Every section point lies on both the cylinder and the plane. The connected inset shows the section square-on in its own plane.'),
        label('micro',1100-c,450,950,510,'Focus F₁','The two foci use c² = a² − b². They belong to the true-view ellipse, not its oblique screen projection.'),
        label('micro',1100+px,450+py,1210,300,'Point P on the ellipse','P is calculated on the ellipse. PF₁ + PF₂ equals 2a, apart from numeric rounding in the drawn coordinates.')]}
  };
  for(const scene of Object.values(scenes)){
    scene.macro=scene.mid=scene.micro=scene.artwork;
    scene.inspectionViews=Object.freeze(Object.fromEntries(['macro','mid','micro'].map((layer,i)=>[layer,Object.freeze(scene.cameras[i])])));
    Object.freeze(scene.cameras);Object.freeze(scene.subjects);scene.labels=Object.freeze(scene.labels.map(Object.freeze));Object.freeze(scene);
  }
  root.IgniteEnvironmentAssets=Object.freeze(scenes);
})(typeof window==='undefined'?globalThis:window);
