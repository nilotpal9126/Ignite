# Surroundings integration

The optional presentation layer extends the existing cream/navy/lime pinboard;
it does not replace page layouts, typography, subject cards or study content.

## Included

- Two continuous scenes: NASA's LRO-based Moon visualization and a methane
  model. Stomata/leaf and mathematical background figures have been removed.
  Each remaining scene retains one artwork at every depth.
- A smoothly interpolated camera approaches the same features as the user scrolls.
  The images appear directly behind the page as the user scrolls, without needing
  to open Explore. The landing hero keeps its paper texture: grains drift in a
  slow flow and respond to actual scroll displacement with directional currents,
  a curling wake, depth-dependent displacement and a short, damped coast.
  Scrolling back reverses the current. Native wheel, touch and keyboard scrolling
  stay unchanged. Maths/Biology use the remaining scenery as ambient backgrounds;
  unsupported subjects retain paper. Removed scene IDs in storage fall back safely.
- Confirmed, verified sign-in changes the outer paper to a mist-blue studio.
  Cream cards, navy text, lime accents, fonts and layouts retain their existing
  design. Sign-out returns the visitor atmosphere; studios keep their own theme.
- A Surroundings menu with Explore, Change (when more than one is eligible), and
  persistent Static paper. Session selection avoids changing scenes on every scroll.
- A native modal inspection view, three depth stages, coordinate-anchored features,
  explanatory text and NASA/OpenStax references. Escape/Back restores position and
  keyboard focus. The underlying page is inert only while the modal is open.
- Subject-aware hooks on homepage samples, the worksheet/question-bank library,
  saved practice, follow-up checks, Play trails and the Labs hub.
- Questions freeze and substantially fade the art. Tests, Focus and standalone
  studios have no ambient art or exploration controls. Existing studio drawings
  and interactions remain untouched.
- Reduced-motion support (including live OS changes), storage-denied and canvas
  fallbacks, print hiding and mobile touch controls. The landing dot canvas draws
  at most about 30 times/second while visible near the hero; it pauses for hidden
  tabs, dialogs, inspection, reduced motion, forced colours and Static paper.
  The scroll camera stops requesting frames after settling.

`environments.js` reads no questions, responses, scores, user identifiers or
attempt keys. It subscribes to the existing identity service and retains only a
verified-session boolean for presentation; it does not initialize authentication
or change access rules. Startup waits for the page's deferred dependencies.
The learning page sends only `{subject, taskMode}` using
`window.IgniteSurroundings?.setContext(...)`. Existing engines and content are
unchanged. Missing runtime/assets do not disable the learning controls.

The public assessment bank remains empty: this work connects the existing test
interface but does not approve or publish pending questions. Browser QA uses a
local-only pending-bank fixture for the three-question flow.

## Adding a scene

Add a registry entry in `environment-assets.js` with a unique id, title, lowercase
subjects, caption, one complete `artwork` SVG fragment, referenceUrl/referenceLabel,
three `cameras` waypoints `[x,y,width,height]`, and labels
`{layer,x,y,pinX,pinY,title,detail}`. Layers are macro/mid/micro; x/y anchors refer
to features, with optional pinX/pinY keeping buttons clear of them. Leader lines
connect pins to their true anchors. The camera passes through waypoints at
depths 0, .55 and 1, interpolating centres and logarithmic dimensions smoothly.
Coordinates share one artwork space at every depth. Legacy macro/mid/micro and
inspectionViews aliases remain for compatibility. The runtime automatically
namespaces SVG IDs. Do not include scripts, external SVG resources, foreignObject,
event handlers or untrusted markup. Include local raster assets explicitly in the
deployment preparer and credit their provenance, as for the NASA image.

Describe artwork as schematic unless its geometry, scale and provenance are
actually supported. Test every layer at 320/390/800/1280px, with non-overlapping
44px pins, reduced motion and blocked storage. Future kidney/weather/space scenes
must be supplied and reviewed individually; they are not part of these two assets.
The existing kidney studio is already linked and retained, not repurposed as a
background.

## Reproduction

`node --test integrations/environments.test.mjs` validates the scene registry.
The root deployment preparer includes all three environment files and the local
Moon image/credit. Browser acceptance harnesses and screenshots for this refinement
are retained separately in `AUTO.PPTX_QBANK_DEV/ignite-environments-refine` and are
not deployed publicly. The earlier rollout is in `ignite-environments-work`.

## Later product scope

The selected student experience remains light. A dark observatory treatment is
deferred for schools and returning clients. A future student community/hangout
space may give students another reason to return and register; its purpose,
age-appropriate interaction model, moderation and account permissions need a
separate product decision. Neither feature is enabled by this presentation layer.
