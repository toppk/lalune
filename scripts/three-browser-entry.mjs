// Only the renderer primitives La Lune needs. Avoid Three.Core's eager global
// revision/devtools registration in the standalone IIFE: loading a classic
// script must not modify a host's Three.js globals or create a renderer.
// These are unmodified modules from the lockfile-pinned three.js package.
export { Vector3 } from 'three/src/math/Vector3.js';
export { Color } from 'three/src/math/Color.js';
export { Scene } from 'three/src/scenes/Scene.js';
export { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
export { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
export { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
export { Mesh } from 'three/src/objects/Mesh.js';
export { TextureLoader } from 'three/src/loaders/TextureLoader.js';
export { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
export { SRGBColorSpace, NoColorSpace, RepeatWrapping } from 'three/src/constants.js';
