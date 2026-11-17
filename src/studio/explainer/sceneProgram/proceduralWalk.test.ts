import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { buildProceduralWalk } from './proceduralWalk';
import { SceneProgram3D } from './stage3d';
import { craneExperimentProgram, craneExperimentSources } from './craneExperiment';

const base = () => normalizeSceneProgram(craneExperimentProgram(), craneExperimentSources);
const vec = (v: number[]) => new THREE.Vector3(...v as [number,number,number]);

describe('grounded procedural actor locomotion (no authored foot curves)', () => {
  it('turns the actor to face its trajectory and moves each foot in alternating swings', () => {
    const p = base();
    const gait = buildProceduralWalk(p, craneExperimentSources, 'worker');
    expect(gait).toBeDefined();
    expect(gait!.totalDistance).toBeGreaterThan(1);
    expect(gait!.at(1).heading).toBeCloseTo(Math.PI / 2, 1);
    const ground = p.nodes.find(n => n.id === 'worker')!.position[1] + .15;
    const phases = Array.from({length:70},(_,i)=>gait!.at(i*.06));
    expect(phases.some(f=>f.leftFoot[1]>ground+.09)).toBe(true);
    expect(phases.some(f=>f.rightFoot[1]>ground+.09)).toBe(true);
    expect(phases.every(f=>f.leftFoot[1]>=ground-.01 && f.rightFoot[1]>=ground-.01)).toBe(true);
  });

  it('locks the stance foot in place while the opposite foot swings', () => {
    const gait = buildProceduralWalk(base(), craneExperimentSources, 'worker')!;
    // First foot swing happens at arc .025..215; right foot remains planted
    // until its own step begins at arc .275.
    const a = gait.at(.65), b = gait.at(1.1);
    expect(vec(a.rightFoot).distanceTo(vec(b.rightFoot))).toBeLessThan(.00001);
    expect(vec(a.leftFoot).distanceTo(vec(b.leftFoot))).toBeGreaterThan(.03);
  });

  it('returns the same deterministic gait after backwards scrubbing', () => {
    const gait = buildProceduralWalk(base(), craneExperimentSources, 'worker')!;
    const expected = gait.at(2.2);
    for (const t of [14, 19, .1, 6, 2.2]) gait.at(t);
    expect(gait.at(2.2)).toEqual(expected);
    expect(gait.at(5).speed).toBeLessThan(.01);
    expect(gait.at(5).bob).toBeCloseTo(0);
  });

  it('integrates into the actual Three.js rig and preserves foot IK reach', () => {
    const p = base();
    const stage = new SceneProgram3D(p, craneExperimentSources);
    try {
      expect(stage.proceduralWalks.has('worker')).toBe(true);
      for(const t of [0,.35,.8,1.2,2,2.75,3.4,4.2,5.5,11,19.7,1.2]) {
        stage.update(t);
        const diagnostics = stage.diagnostics();
        expect(diagnostics.maxIKError).toBeLessThan(.025);
      }
      try { stage.validateContacts(); }
      catch (error) { throw new Error(JSON.stringify({ message: (error as Error).message, diagnostic: (error as {diagnostic?: unknown}).diagnostic })); }
      stage.update(2);
      expect(stage.nodes.get('worker')!.rotation.y).toBeCloseTo(Math.PI / 2, 1);
      const first = vec(stage.actors.get('worker')!.limbs.leftFoot.hand.getWorldPosition(new THREE.Vector3()).toArray());
      stage.update(12);stage.update(0);stage.update(2);
      const repeat = stage.actors.get('worker')!.limbs.leftFoot.hand.getWorldPosition(new THREE.Vector3());
      expect(first.distanceTo(repeat)).toBeLessThan(1e-6);
    } finally {stage.dispose();}
  });

  it('respects explicit foot keyframes, explicit root rotation and authored contacts', () => {
    const original = craneExperimentProgram();
    const authored = structuredClone(original) as any;
    authored.tracks.push({
      node:'worker', channel:'leftFoot', interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[-3.2,.1,1.6]},
        {sourceId:'s1',phase:1,value:[-2.2,.1,1.6]}],
    });
    expect(buildProceduralWalk(normalizeSceneProgram(authored, craneExperimentSources),craneExperimentSources,'worker')).toBeUndefined();

    const turn = structuredClone(original) as any;
    turn.tracks.push({
      node:'worker',channel:'rotation',interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[0,0,0]},
        {sourceId:'s1',phase:1,value:[0,1,0]}],
    });
    expect(buildProceduralWalk(normalizeSceneProgram(turn,craneExperimentSources),craneExperimentSources,'worker')).toBeUndefined();
  });

  it('never turns vertical climbing into automatic flat-ground walking', () => {
    const source:ProgramSource[]=[{sourceId:'s1',text:'O operário sobe na montanha.',duration:5}];
    const raw = {
      version:1,background:'#94cdee',
      nodes:[{id:'person',kind:'actor',contextSourceId:'s1'}],
      tracks:[{node:'person',channel:'position',interpolation:'linear',keys:[
        {sourceId:'s1',phase:0,value:[0,0,0]},
        {sourceId:'s1',phase:1,value:[1,2,0]},
      ]}],
      shots:[{sourceId:'s1',subjects:['person'],azimuth:0,endAzimuth:0,elevation:.1,distance:1.2}],
      contacts:[],
    };
    const p=normalizeSceneProgram(raw,source);
    expect(buildProceduralWalk(p,source,'person')).toBeUndefined();
  });

  it('moves pelvis and torso in opposing directions without losing deterministic poses', () => {
    const p = base();
    const walk = buildProceduralWalk(p, craneExperimentSources, 'worker')!;
    const moving = walk.at(1.2);
    expect(Math.abs(moving.weightShift)).toBeGreaterThan(.001);
    expect(Math.abs(moving.torsoTwist)).toBeGreaterThan(.001);
    expect(moving.torsoTwist * moving.headCounter).toBeLessThan(0);
    const stopped = walk.at(5.5);
    expect(stopped.speed).toBeLessThan(.01);
    expect(stopped.weightShift).toBe(0);
    expect(stopped.torsoTwist).toBe(0);

    const stage = new SceneProgram3D(p, craneExperimentSources);
    try {
      stage.update(1.2);
      const actor = stage.actors.get('worker')!;
      expect(actor.spine.rotation.y).toBeCloseTo(moving.torsoTwist);
      expect(actor.hips.position.x).toBeCloseTo(moving.weightShift);
      const first = actor.spine.rotation.y;
      stage.update(15);
      stage.update(.1);
      stage.update(1.2);
      expect(actor.spine.rotation.y).toBeCloseTo(first);
    } finally {
      stage.dispose();
    }
  });

  it('holds a carrying hand steady instead of swinging a heavy bag', () => {
    const walk = buildProceduralWalk(base(), craneExperimentSources, 'worker')!;
    const a = walk.at(.7), b = walk.at(1.8);
    expect(a.rightHand).toEqual(b.rightHand);
    expect(Math.abs(a.leftHand[2] - b.leftHand[2])).toBeGreaterThan(.01);
  });

  it('turns shoes with the walking direction, adding only a small foot roll', () => {
    const stage = new SceneProgram3D(base(), craneExperimentSources);
    try {
      stage.update(1.3);
      const actor = stage.actors.get('worker')!;
      const bodyWorld = actor.root.getWorldQuaternion(new THREE.Quaternion());
      for(const foot of ['leftFoot','rightFoot'] as const) {
        const shoeWorld = actor.limbs[foot].hand.getWorldQuaternion(new THREE.Quaternion());
        expect(bodyWorld.angleTo(shoeWorld)).toBeLessThan(.16);
      }
      expect(stage.diagnostics().maxIKError).toBeLessThan(.025);
      stage.validateContacts();
    } finally { stage.dispose(); }
  });
});
