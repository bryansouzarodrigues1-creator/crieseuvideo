// Pinned three.js copy (the version installed in package.json) shipped as text
// into the code-3D sandbox, where it becomes blob: modules. Loaded lazily only
// on the experimental route. Never fetched from a CDN.
import core from '../../../node_modules/three/build/three.core.js?raw';
import module from '../../../node_modules/three/build/three.module.js?raw';
export const threeSources = { core, module };
