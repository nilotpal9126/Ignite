'use strict';
(function(root){
  const studios=[
    {id:'force',board:'ICSE',classLevel:10,subject:'Physics',title:'Force & moments',description:'Balance metre rules, compare turning effects and investigate couples.',tag:'8 textbook challenges',symbol:'↔',colour:'#a0dfbf',path:'labs/station-helios-student/Force-Moments-Lab.html',chapters:['Force','Turning Effect of Forces','Moments and Equilibrium']},
    {id:'genetics',board:'ICSE',classLevel:10,subject:'Biology',title:'Genetics & heredity',description:'Build a cross, inspect a 3D chromosome pair and trace inheritance through a family.',tag:'4 experiments · 3D chromosomes',symbol:'Bb',colour:'#b7acf2',path:'labs/ignite-biology-labs/Genetics-Heredity-Lab.html',chapters:['Genetics','Genetics and Heredity','Genetics & Heredity','Heredity']},
    {id:'kidney',board:'ICSE',classLevel:10,subject:'Biology',title:'The kidney studio',description:'Rotate the nephron, investigate filtration pressure and follow useful substances back to blood.',tag:'4 experiments · 3D nephron',symbol:'∿',colour:'#a8cbf2',path:'labs/ignite-biology-labs/Excretory-Nephron-Lab.html',chapters:['Excretion','The Excretory System','Excretory System']},
    {id:'chemistry',board:'ICSE',classLevel:10,subject:'Chemistry',title:'Bonding & periodic patterns',description:'Turn a molecule in 3D, count shared pairs and connect shells with periodic patterns.',tag:'4 experiments · 3D molecules',symbol:'⚛',colour:'#e9c585',path:'labs/ignite-chemistry-labs/Chemical-Bonding-3D-Lab.html',chapters:['Chemical Bonding','Periodic Properties','Periodic Properties and Variations of Properties','Periodic Table']}
  ];
  const normal=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const forTrack=(track,board)=>{
    if(!track||Number(track.classLevel)!==10)return null;
    const studio=studios.find(s=>s.board===board&&s.subject===track.subject&&s.chapters.some(c=>normal(c)===normal(track.title)));
    if(!studio)return null;
    return {...studio,path:studio.path+(studio.id==='chemistry'&&normal(track.title).startsWith('periodic')?'#periodic':'')};
  };
  root.IgniteStudioRegistry=Object.freeze({studios:Object.freeze(studios.map(s=>Object.freeze({...s,chapters:Object.freeze(s.chapters)}))),forBoard:board=>studios.filter(s=>s.board===board),get:id=>studios.find(s=>s.id===id)||null,forTrack});
})(typeof window==='undefined'?globalThis:window);
