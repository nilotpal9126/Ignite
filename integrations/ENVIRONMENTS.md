# Surroundings integration

The optional presentation layer extends the existing cream/navy/lime pinboard;
it does not replace page layouts, typography, subject cards or study content.

## Included

- Four procedural scenes: Moon, leaf/stomata, carbon bonding, geometric sections.
- Scroll-driven grain, gentle depth changes, and a quieter paper ending.
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
- Reduced-motion support (including live OS changes), storage-denied fallbacks,
  no animation loop while idle, print hiding, and mobile touch controls.

`environments.js` reads no questions, responses, scores, identity or attempt keys.
The page sends only `{subject, taskMode}` using
`window.IgniteSurroundings?.setContext(...)`. Existing engines and content are
unchanged. Missing runtime/assets do not disable the learning controls.

The public assessment bank remains empty: this work connects the existing test
interface but does not approve or publish pending questions. Browser QA uses a
local-only pending-bank fixture for the three-question flow.

## Adding a scene

Add a registry entry in `environment-assets.js` with a unique id, title, lowercase
subjects, caption, macro/mid/micro SVG fragments, referenceUrl/referenceLabel,
labels `{layer,x,y,title,detail}`, and optional `inspectionViews` per-layer
`[x,y,width,height]` view boxes. Coordinates are in the artwork's 1440 by 900
coordinate space, even for cropped inspection views. The runtime automatically
namespaces SVG pattern IDs. Do not include scripts, external SVG resources,
foreignObject, event handlers or untrusted markup. Use the existing colour aliases.

Describe artwork as schematic unless its geometry, scale and provenance are
actually supported. Test every layer at 320/390/800/1280px, with non-overlapping
44px pins, reduced motion and blocked storage. Future kidney/weather/space scenes
must be supplied and reviewed individually; they are not part of these four assets.
The existing kidney studio is already linked and retained, not repurposed as a
background.

## Reproduction

`node --test integrations/environments.test.mjs` validates the scene registry.
The root deployment preparer includes all three environment files. Browser
acceptance harnesses and screenshots for this rollout are retained separately in
`AUTO.PPTX_QBANK_DEV/ignite-environments-work` and are not deployed publicly.
