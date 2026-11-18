import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InkOutline, skyStops, skyTexture, toonMaterial } from './look';

const luma = (c: THREE.Color) => { const h = { h: 0, s: 0, l: 0 }; c.getHSL(h, THREE.SRGBColorSpace); return h.l; };

describe('toon look', () => {
  it('daylight sky is deeper at the top and hazier at the horizon', () => {
    const { top, bottom } = skyStops('#B6D7EA');
    expect(luma(bottom)).toBeGreaterThan(luma(top));
  });
  it('night sky stays dark and only gains a faint horizon glow', () => {
    const { top, bottom } = skyStops('#101A35');
    expect(luma(top)).toBeLessThan(.2); expect(luma(bottom)).toBeLessThan(.3); expect(luma(bottom)).toBeGreaterThan(luma(top));
  });
  it('sky texture is a deterministic opaque vertical ramp', () => {
    const a = skyTexture('#87CEEB'), b = skyTexture('#87CEEB'), d = a.texture.image.data as Uint8Array;
    expect(Array.from(d)).toEqual(Array.from(b.texture.image.data as Uint8Array));
    expect(d.length).toBe(64 * 4); for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(255);
    expect(d[0] !== d[d.length - 4] || d[1] !== d[d.length - 3]).toBe(true);
  });
  it('toon materials use the shared stepped light ramp', () => {
    const m = toonMaterial({ color: '#ff0000' }); expect(m.gradientMap?.minFilter).toBe(THREE.NearestFilter);
    expect(toonMaterial({ color: '#00ff00' }).gradientMap).toBe(m.gradientMap);
  });
  it('outline hull welds hard edges so box corners stay closed', () => {
    const ink = new InkOutline(), hull = ink.hull(new THREE.BoxGeometry(1, 1, 1));
    expect(hull.geometry.attributes.position.count).toBe(8); expect(hull.geometry.getAttribute('normal').count).toBe(8);
  });
  it('keeps one pixel-constant line width across resolutions and ignores tiny parts', () => {
    const ink = new InkOutline(); ink.resize(720, 1280); const thin = ink.material.uniforms.uThickness.value; ink.resize(1440, 2560);
    expect(ink.material.uniforms.uThickness.value).toBeLessThan(thin * 1.01); // same on-screen ratio at any resolution
    const tiny = new THREE.Mesh(new THREE.SphereGeometry(.02, 6, 4), new THREE.MeshBasicMaterial()); ink.attach(tiny, .1); expect(tiny.children).toHaveLength(0);
    const big = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial()); ink.attach(big, .1); expect(big.children).toHaveLength(1);
  });
});
