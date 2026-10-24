'use strict';
(function(root){
// js/previewEnvironments.js

const SHARED_DEFS = `
  <defs>
    <!-- Fine Scientific Stipple Pattern -->
    <pattern id="ignite-stipple" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="0.9" class="stipple-dot" />
      <circle cx="11" cy="7" r="0.6" class="stipple-dot" />
      <circle cx="6" cy="13" r="0.75" class="stipple-dot" />
      <circle cx="14" cy="14" r="0.5" class="stipple-dot" />
    </pattern>
    <!-- Denser Stipple for Shadows & Crater Walls -->
    <pattern id="ignite-stipple-dense" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" class="stipple-dot" />
      <circle cx="7" cy="4" r="0.8" class="stipple-dot" />
      <circle cx="4" cy="8" r="0.9" class="stipple-dot" />
      <circle cx="8" cy="9" r="0.6" class="stipple-dot" />
    </pattern>
  </defs>
`;

// Orthographic projection of four equal tetrahedral directions. Projected angles
// differ from the 3D bond angle; no angle is measured from the 2D artwork.
const tetrahedralDirections = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
function tetrahedralBonds(size, ox, oy) {
  const projected = tetrahedralDirections.map(([x,y,z]) => [ox + size * (0.7*x-0.4*z), oy + size * (-0.65*y+0.3*z),z]);
  return projected.map(([x,y,z]) => `<line x1="${ox}" y1="${oy}" x2="${x}" y2="${y}" class="${z<0?'line-secondary':'line-primary'}"/>`).join('')
    + projected.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="24" fill="url(#ignite-stipple)" class="line-primary"/>`).join('')
    + `<circle cx="${ox}" cy="${oy}" r="36" fill="var(--env-chemistry-blue)" class="line-primary"/>`;
}
const ellipse = {a:310,b:175};
ellipse.c = Math.sqrt(ellipse.a**2-ellipse.b**2);
ellipse.px = 110;
ellipse.py = -ellipse.b * Math.sqrt(1-ellipse.px**2/ellipse.a**2);
const PREVIEW_ENVIRONMENTS = {
  /* ========================================================================
     1. LUNAR SURFACE (Physics & Space)
     Distant terminator speckling -> Crater contour rings -> Regolith & ejecta
     ======================================================================== */
  lunar_surface: {
    inspectionViews: {micro:[300,100,840,700]},
    id: "lunar_surface",
    title: "Lunar Surface",
    caption: "Earth’s Moon · illustrated crater features · not to scale",
    subjects: ["physics", "general"],
    macro: `
      ${SHARED_DEFS}
      <!-- Faint Lunar Limb & Mare Stipple -->
      <path d="M -100,780 Q 720,420 1540,780 L 1540,950 L -100,950 Z" fill="var(--env-physics-yellow)" class="subject-wash" />
      <path d="M -100,780 Q 720,420 1540,780" class="line-primary" />
      <path d="M -50,820 Q 720,470 1490,820" class="line-secondary" />
      <ellipse cx="420" cy="690" rx="210" ry="68" fill="url(#ignite-stipple)" />
      <ellipse cx="980" cy="650" rx="160" ry="52" fill="url(#ignite-stipple)" />
      <ellipse cx="420" cy="690" rx="210" ry="68" class="line-secondary" />
      <ellipse cx="980" cy="650" rx="160" ry="52" class="line-secondary" />
    `,
    mid: `
      ${SHARED_DEFS}
      <!-- Recognisable Crater Topographic Contours -->
      <g transform="translate(720, 460)">
        <ellipse cx="0" cy="0" rx="390" ry="260" fill="var(--env-physics-yellow)" class="subject-wash" />
        <ellipse cx="0" cy="0" rx="390" ry="260" class="line-secondary" />
        <ellipse cx="0" cy="0" rx="310" ry="205" class="line-primary" />
        <ellipse cx="0" cy="0" rx="240" ry="158" fill="url(#ignite-stipple)" class="line-primary" />
        <ellipse cx="0" cy="0" rx="175" ry="114" class="line-fine" />
        <!-- Secondary Offset Crater -->
        <ellipse cx="-290" cy="-140" rx="85" ry="58" fill="var(--bg-paper)" class="line-primary" />
        <ellipse cx="-290" cy="-140" rx="62" ry="42" fill="url(#ignite-stipple-dense)" class="line-fine" />
        <!-- Radial Ejecta Lines -->
        <line x1="-320" y1="-210" x2="-480" y2="-310" class="line-secondary" />
        <line x1="330" y1="-190" x2="520" y2="-290" class="line-secondary" />
        <line x1="280" y1="210" x2="460" y2="330" class="line-secondary" />
      </g>
    `,
    micro: `
      ${SHARED_DEFS}
      <!-- Close Detail: Terraced Rim Wall, Central Peak & Regolith Fractures -->
      <g transform="translate(720, 450)">
        <circle cx="0" cy="0" r="340" fill="url(#ignite-stipple)" />
        <!-- Terraced Slump Blocks -->
        <path d="M -280,-120 C -180,-260 180,-260 280,-120" class="line-primary" />
        <path d="M -250,-85 C -150,-215 150,-215 250,-85" class="line-primary" />
        <path d="M -290,110 C -170,255 170,255 290,110" class="line-primary" />
        <!-- Central Peak Complex (Hachured) -->
        <polygon points="-45,25 0,-38 48,22 18,45 -28,42" fill="var(--env-physics-yellow)" class="line-primary" />
        <polyline points="-22,12 0,-18 24,14" class="line-fine" />
        <circle cx="95" cy="-45" r="24" fill="url(#ignite-stipple-dense)" class="line-primary" />
        <circle cx="-110" cy="60" r="16" fill="url(#ignite-stipple-dense)" class="line-primary" />
        <circle cx="65" cy="95" r="11" class="line-fine" />
      </g>
    `
  },

  /* ========================================================================
     2. LEAF-TO-CELL (Biology)
     Dicot leaf margin -> Reticulate vein network -> Stomata & guard cells
     ======================================================================== */
  leaf_to_cell: {
    inspectionViews: {micro:[450,250,540,400]},
    id: "leaf_to_cell",
    title: "Leaf Venation to Stomata",
    caption: "Leaf to stomata · schematic views at different scales",
    subjects: ["biology"],
    macro: `
      ${SHARED_DEFS}
      <!-- Distant Dicot Leaf Blade Silhouette & Primary Midrib -->
      <path d="M 180,860 C 260,340 740,110 1290,80 C 1210,540 820,810 180,860 Z"
            fill="var(--env-biology-mint)" class="subject-wash" />
      <path d="M 180,860 C 260,340 740,110 1290,80 C 1210,540 820,810 180,860 Z"
            class="line-primary" />
      <path d="M 140,890 Q 680,460 1290,80" class="line-primary" />
    `,
    mid: `
      ${SHARED_DEFS}
      <!-- Recognisable Secondary & Tertiary Reticulate Venation -->
      <g>
        <path d="M 80,880 Q 700,440 1360,40" class="line-primary" stroke-width="2" />
        <!-- Upper Lateral Veins -->
        <path d="M 420,645 C 390,460 470,310 620,210" class="line-primary" />
        <path d="M 670,475 C 650,320 740,200 910,120" class="line-primary" />
        <path d="M 930,305 C 940,210 1020,140 1140,95" class="line-primary" />
        <!-- Lower Lateral Veins -->
        <path d="M 380,670 C 560,710 740,670 920,550" class="line-primary" />
        <path d="M 640,495 C 820,530 990,480 1160,360" class="line-primary" />
        <!-- Areole Mesh & Stipple -->
        <polygon points="480,490 590,420 640,495 540,575" fill="var(--env-biology-mint)" class="line-fine" />
        <polygon points="640,495 770,410 830,480 710,560" fill="url(#ignite-stipple)" class="line-fine" />
        <polygon points="560,360 670,290 730,375 610,430" fill="url(#ignite-stipple)" class="line-fine" />
      </g>
    `,
    micro: `
      ${SHARED_DEFS}
      <!-- Close Detail: Stomatal Apparatus, Guard Cells, Chloroplasts & Epidermis -->
      <g transform="translate(720, 450)">
        <!-- Surrounding Wavy Epidermal Pavement Cells -->
        <path d="M -420,-180 Q -310,-240 -210,-170 T 0,-190 T 210,-160 T 410,-200" class="line-fine" />
        <path d="M -420,190 Q -290,250 -180,180 T 30,210 T 240,170 T 420,210" class="line-fine" />
        <path d="M -360,-220 C -420,-80 -350,80 -380,220" class="line-fine" />
        <path d="M 360,-220 C 410,-70 340,90 380,220" class="line-fine" />

        <!-- Left Kidney-Shaped Guard Cell -->
        <path d="M 0,-155 C -145,-155 -210,-75 -210,0 C -210,75 -145,155 0,155 C -42,95 -52,45 -52,0 C -52,-45 -42,-95 0,-155 Z"
              fill="var(--env-biology-mint)" class="line-primary" />
        <!-- Right Kidney-Shaped Guard Cell -->
        <path d="M 0,-155 C 145,-155 210,-75 210,0 C 210,75 145,155 0,155 C 42,95 52,45 52,0 C 52,-45 42,-95 0,-155 Z"
              fill="var(--env-biology-mint)" class="line-primary" />

        <!-- Open Stomatal Pore (Aperture) -->
        <ellipse cx="0" cy="0" rx="36" ry="92" fill="url(#ignite-stipple-dense)" class="line-primary" />

        <!-- Chloroplast Organelles Inside Guard Cells -->
        <ellipse cx="-115" cy="-65" rx="16" ry="9" transform="rotate(-25 -115 -65)" class="line-fine" fill="url(#ignite-stipple)" />
        <ellipse cx="-135" cy="0" rx="18" ry="10" class="line-fine" fill="url(#ignite-stipple)" />
        <ellipse cx="-110" cy="70" rx="16" ry="9" transform="rotate(25 -110 70)" class="line-fine" fill="url(#ignite-stipple)" />
        <ellipse cx="115" cy="-65" rx="16" ry="9" transform="rotate(25 115 -65)" class="line-fine" fill="url(#ignite-stipple)" />
        <ellipse cx="135" cy="0" rx="18" ry="10" class="line-fine" fill="url(#ignite-stipple)" />
        <ellipse cx="110" cy="70" rx="16" ry="9" transform="rotate(-25 110 70)" class="line-fine" fill="url(#ignite-stipple)" />
      </g>
    `
  },

  /* ========================================================================
     3. MOLECULAR STRUCTURE (Chemistry)
     Symmetry lattice points -> Tetrahedral crystal network -> Orbital density
     ======================================================================== */
  molecular_lattice: {
    inspectionViews: {micro:[300,100,840,700]},
    id: "molecular_lattice",
    title: "Carbon bonding",
    caption: "Tetrahedral carbon bonding · projected schematic, not measured electron density",
    subjects: ["chemistry"],
    macro: `${SHARED_DEFS}<g transform="translate(720 450)">
      <path d="M-340 -170L-80 -300 220 -170 340 150 80 300-220 170Z" class="line-secondary"/>
      ${tetrahedralBonds(170,-190,80)}${tetrahedralBonds(170,190,-80)}
    </g>`,
    mid: `${SHARED_DEFS}<g transform="translate(720 450)">${tetrahedralBonds(240,0,0)}</g>`,
    micro: `${SHARED_DEFS}<g transform="translate(720 450)">
      <ellipse cx="-90" cy="0" rx="155" ry="90" fill="var(--env-chemistry-blue)" class="subject-wash"/>
      <ellipse cx="90" cy="0" rx="155" ry="90" fill="url(#ignite-stipple)" class="line-fine"/>
      <line x1="-150" y1="0" x2="150" y2="0" class="line-primary"/>
      <circle cx="-150" cy="0" r="35" fill="var(--bg-paper)" class="line-primary"/>
      <circle cx="150" cy="0" r="35" fill="var(--bg-paper)" class="line-primary"/>
      <text x="-150" y="8" text-anchor="middle" class="env-art-label">C</text>
      <text x="150" y="8" text-anchor="middle" class="env-art-label">C</text>
    </g>`
  },

  /* ========================================================================
     4. GEOMETRIC CROSS-SECTIONS (Mathematics)
     Isometric coordinate grid -> Wireframe cylinder -> Sliced elliptical locus
     ======================================================================== */
  geometric_cross_sections: {
    inspectionViews: {micro:[300,100,840,700]},
    id: "geometric_cross_sections",
    title: "Conic & Cylindrical Cross-Sections",
    caption: "Euclidean Geometry · Oblique Plane Intersecting a Right Circular Cylinder",
    subjects: ["mathematics"],
    macro: `
      ${SHARED_DEFS}
      <!-- Distant Isometric Coordinate Axes -->
      <g transform="translate(720, 450)">
        <line x1="0" y1="-400" x2="0" y2="400" class="line-secondary" />
        <line x1="-600" y1="-346.410162" x2="600" y2="346.410162" class="line-fine" />
        <line x1="-600" y1="346.410162" x2="600" y2="-346.410162" class="line-fine" />
        <circle cx="0" cy="0" r="260" class="line-secondary" />
      </g>
    `,
    mid: `
      ${SHARED_DEFS}
      <!-- Recognisable Wireframe Cylinder & Intersecting Oblique Plane -->
      <g transform="translate(720, 450)">
        <!-- Cylinder Top & Bottom Caps -->
        <ellipse cx="0" cy="-210" rx="180" ry="56" class="line-primary" />
        <ellipse cx="0" cy="210" rx="180" ry="56" class="line-primary" />
        <line x1="-180" y1="-210" x2="-180" y2="210" class="line-primary" />
        <line x1="180" y1="-210" x2="180" y2="210" class="line-primary" />

        <!-- Intersecting Slicing Plane Parallelogram -->
        <polygon points="-260,110 220,-150 260,-70 -220,190"
                 fill="var(--env-math-lilac)" class="line-secondary" />

        <!-- Resulting Elliptical Cross-Section -->
        <ellipse cx="0" cy="0" rx="198" ry="88" transform="rotate(-24)"
                 fill="url(#ignite-stipple)" class="line-primary" />
      </g>
    `,
    micro: `
      ${SHARED_DEFS}
      <!-- Close Detail: True-View Elliptical Locus, Foci (F1, F2) & Directrix -->
      <g transform="translate(720, 450)">
        <ellipse cx="0" cy="0" rx="310" ry="175" fill="var(--env-math-lilac)" class="subject-wash" />
        <ellipse cx="0" cy="0" rx="310" ry="175" class="line-primary" />
        <ellipse cx="0" cy="0" rx="256" ry="120" fill="url(#ignite-stipple)" class="line-fine" />

        <!-- Major & Minor Axes -->
        <line x1="-360" y1="0" x2="360" y2="0" class="line-secondary" />
        <line x1="0" y1="-220" x2="0" y2="220" class="line-secondary" />

        <!-- Foci F1 & F2 + Constant Sum Focal Radii (PF1 + PF2 = 2a) -->
        <circle cx="${-ellipse.c}" cy="0" r="6" fill="var(--ink-navy)" />
        <circle cx="${ellipse.c}" cy="0" r="6" fill="var(--ink-navy)" />
        <circle cx="${ellipse.px}" cy="${ellipse.py}" r="6" fill="var(--bg-paper)" class="line-primary" />
        <line x1="${-ellipse.c}" y1="0" x2="${ellipse.px}" y2="${ellipse.py}" class="line-primary" />
        <line x1="${ellipse.c}" y1="0" x2="${ellipse.px}" y2="${ellipse.py}" class="line-primary" />
      </g>
    `
  }
};
const annotations = {
  lunar_surface: {
    referenceUrl:'https://science.nasa.gov/moon/lunar-craters/', referenceLabel:'NASA · lunar craters',
    labels:[
      {layer:'macro',x:420,y:690,title:'Lunar surface',detail:'An illustration of cratered terrain. It is not a map of a named lunar region.'},
      {layer:'mid',x:430,y:320,title:'Crater rim',detail:'The rim surrounds an impact crater. These outlines show the form schematically, without a measured scale.'},
      {layer:'micro',x:720,y:450,title:'Central peak',detail:'Large complex craters can have central peaks formed as the crater floor rebounds.'},
      {layer:'micro',x:720,y:245,title:'Terraced wall',detail:'Collapse of steep crater walls can leave step-like terraces.'}
    ]
  },
  leaf_to_cell: {
    referenceUrl:'https://openstax.org/books/biology-2e/pages/30-4-leaves', referenceLabel:'OpenStax · leaves',
    labels:[
      {layer:'macro',x:700,y:450,title:'Leaf blade and midrib',detail:'The blade presents a broad surface to light. Veins contain tissues that transport water and sugars.'},
      {layer:'mid',x:640,y:495,title:'Vein network',detail:'Reticulate venation forms a branching network within the leaf.'},
      {layer:'micro',x:605,y:450,title:'Guard cells',detail:'The two guard cells regulate the opening of the stomatal pore. Their shape changes with water content.'},
      {layer:'micro',x:720,y:450,title:'Stomatal pore',detail:'This opening allows gas exchange and water-vapour loss. The illustration is not to scale.'},
      {layer:'micro',x:835,y:385,title:'Chloroplasts',detail:'Chloroplasts are shown inside the guard cells. Their size and placement here are schematic.'}
    ]
  },
  molecular_lattice: {
    referenceUrl:'https://openstax.org/books/organic-chemistry/pages/1-6-sp3-hybrid-orbitals-and-the-structure-of-methane', referenceLabel:'OpenStax · tetrahedral bonding',
    labels:[
      {layer:'macro',x:530,y:530,title:'Repeated bonding units',detail:'This sketch repeats tetrahedral units to suggest a covalent network. It is not a crystallographic measurement.'},
      {layer:'mid',x:720,y:450,title:'Four bond directions',detail:'Four equivalent tetrahedral directions have a 3D angle of approximately 109.5°. Angles in this 2D projection look different.'},
      {layer:'micro',x:720,y:450,title:'Covalent bond',detail:'A covalent bond involves shared electrons. The shaded region is an illustration, not a computed probability-density plot.'}
    ]
  },
  geometric_cross_sections: {
    referenceUrl:'https://openstax.org/books/precalculus-2e/pages/10-1-the-ellipse', referenceLabel:'OpenStax · the ellipse',
    labels:[
      {layer:'macro',x:720,y:450,title:'Projected axes',detail:'These are isometric projected coordinate directions. They help suggest depth on a flat page.'},
      {layer:'mid',x:720,y:450,title:'Cylinder section',detail:'A suitable oblique plane through a right circular cylinder produces an elliptical section. This is a schematic view.'},
      {layer:'micro',x:720-ellipse.c,y:450,title:'Focus F₁',detail:'Every point on this ellipse has the same total distance to its two foci: PF₁ + PF₂ = 2a.'},
      {layer:'micro',x:720+ellipse.px,y:450+ellipse.py,title:'Point P on the ellipse',detail:'The point is calculated from x²/a² + y²/b² = 1. The foci use c² = a² − b².'}
    ]
  }
};
for(const [id,scene] of Object.entries(PREVIEW_ENVIRONMENTS)) {
  Object.assign(scene,annotations[id]);
  scene.inspectionViews=Object.freeze(Object.fromEntries(Object.entries(scene.inspectionViews).map(([layer,view])=>[layer,Object.freeze(view)])));
  scene.subjects=Object.freeze(scene.subjects);
  scene.labels=Object.freeze(scene.labels.map(label=>Object.freeze(label)));
  Object.freeze(scene);
}
root.IgniteEnvironmentAssets = Object.freeze(PREVIEW_ENVIRONMENTS);
})(typeof window === 'undefined' ? globalThis : window);
