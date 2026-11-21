# Carrying with curved steps and measured placement

The previous study checked straight walking and a static handrail contact. The new original workshop scene adds a low pickup, two-handed lift, curved route around a toolbox, measured bench placement, release and a recovery gesture. It is a manually directed fictional study, not an autonomous Gemini generation.

The optional version-1 scene helpers are extended additively:

- `createWalkPath(points)` builds an arc-length Catmull–Rom route. `at(distance)` returns point, horizontal tangent and yaw.
- `walkOnPath({path,distance,stride,width,lift,surface,settle})` creates per-foot world anchors and orientations. Body yaw changes do not rotate a supporting foot. `settle` closes the staggered stance after arrival.
- `setWorldPose` and `objectGrips` keep a single cargo object and its hand targets in the same world frame, including under transformed parents.
- `createPropTransfer(object,{source,pickup,release,heldAt})` checks pickup continuity and computes the placed pose directly from `heldAt(release)`. Rendering a later frame first cannot change the release point.
- The actor preserves the requested sole contact when shoes pitch or turn, and accepts an effort expression and knee spreading during a low pickup. Eyelids now close the eye group together rather than only shrinking a pupil.

The workshop route is hand planned and tested against one toolbox; these helpers do not supply autonomous navigation, balance simulation or rigid-body physics. The bench top is registered geometry and the cargo's actual lower bounds determine placement. A denser pose check caught a trailing leg outside reach during a tight turn; lowering the pelvis while carrying restored sole contact instead of relaxing the error threshold. Arm and leg reach errors must still be checked, and the encoded movie must be inspected for occlusion, clipping, contact and continuity.

The native study button remains explicit. Imports, playback and export do not request a model, and the same opaque sandbox, source/token checks, CSP and fixed Three.js modules remain in use. A reduced eight-second review may play the twelve-second story at 1.5× speed; final delivery uses the original twelve-second timing. The native export contains silent pictures; effects are an explicit finishing step.

Next progression: interaction between two actors using the same object, then validate the generation/review/correction flow with a model before extending duration. Do not describe a manually authored example as proof of autonomous generation or production deployment.
