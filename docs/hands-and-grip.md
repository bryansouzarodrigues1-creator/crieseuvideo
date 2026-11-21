# Oriented wrists and articulated grip

The workshop feedback exposed a real limitation: a sphere at the IK endpoint was called a hand, and a center-point contact check could pass while the visible hand overlapped the box. This revision adds an explicit articulated-hand profile and a close review of the same pickup and release.

## Frame and compatibility

`createPerson({hands:'articulated'})` creates a wrist, palm, four three-segment fingers and an opposed two-segment thumb. The older hand profile and Vector3 targets remain compatible.

`graspFrames(object,[{point,normal,fingers},...])` transforms local contact anchors and orientations into world-space `{point,quaternion}` descriptors. The hand's local +Z is its palm normal and +Y is the open-finger direction. The thumb mirrors between left and right hands. A descriptor passed to `pose` includes `grip` in [0,1]; the solver subtracts the rotated palm-to-grip offset before targeting the wrist. Returned hand markers indicate the grip center for descriptors, rather than pretending that grip center and wrist are the same point.

Fingers preserve segment lengths while curling, and the thumb uses the two-bone solver. The particular closing pose is designed for a vertical cylindrical bar of radius .018, with room behind the handle. The scene's handles and hand frames share those dimensions. This is an authored grip, not arbitrary-object grasp synthesis or hand physics.

## Timing and geometry

The body lowers before the hands complete their approach. Hands arrive open at 1.6 s and finish closing by 1.8 s; cargo movement starts at 1.85 s. At the bench, the cargo reaches support at 9.45 s, fingers open from 9.5–9.8 s, hands withdraw radially from 9.8–10.1 s and then lower from 10.1–10.5 s. Every pose is derived from absolute time.

Capsule samples from actual finger/thumb segments and conservative palm/wrist volumes check clearance against cargo bounds and handle bars over the complete sequence. Center-target, arm reach, foot support, knee clearance and release tests remain in place. Samples approximate the meshes and do not establish general collision physics or biomechanical correctness.

The additional eight-second review uses the same original scene, geometry and hand poses with a closer camera and slower pickup/release intervals. It is explicitly a review montage, not a new generated model response. The twelve-second workshop sequence keeps its overall story. Both are rendered through the real studio and opaque sandbox, with explicit buttons and no model calls on import, playback or export.

Validate the reduced close review before full output. Inspect finger silhouettes, thumb side, wrist/forearm connection, opening order, clipping and hand visibility in encoded pictures. Numerical contact alone is insufficient to claim natural hands. Keep the interaction between two actors as the next stage after this correction.
