import { describe, expect, it } from 'vitest';
import { compileStoryEvents } from './events';
import { compileStoryMotion } from './choreographer';
import { planGripContacts } from './gripContacts';
import { sampleStoryProposal, sampleSceneGeometry, sampleSources, sampleBindings } from './sample';
import { SceneProgram3D } from '../stage3d';

const story=()=>compileStoryEvents(sampleStoryProposal(),sampleSources);

describe('IK hand constraints derived from semantic pickup and release',()=>{
  it('tracks the same cargo root through the entire carry, then releases before the object rests',()=>{
    const plan=planGripContacts(story(),sampleSources,sampleBindings.entityNodes);
    expect(plan.windows).toHaveLength(1);
    expect(plan.windows[0]).toMatchObject({
      cargo:'saco',actor:'trabalhador',contactCount:4
    });
    expect(plan.windows[0]!.from).toBeGreaterThan(.90);
    expect(plan.windows[0]!.to).toBeGreaterThan(4.5);
    expect(plan.windows[0]!.to).toBeLessThan(5.1);
    expect(plan.contacts.map(c=>c.sourceId)).toEqual(['s1','s1','s2','s2']);
    expect(plan.contacts.every(c=>c.actor==='trabalhador'&&c.target==='saco')).toBe(true);
    expect(new Set(plan.contacts.map(c=>c.effector))).toEqual(new Set(['leftHand','rightHand']));
  });

  it('hands follow the SAME cargo in the existing Three.js IK implementation',()=>{
    const s=story();
    const compiled=compileStoryMotion(s,sampleSceneGeometry(),sampleSources,sampleBindings);
    expect(compiled.diagnostics.gripWindows[0]?.contactCount).toBe(4);
    const stage=new SceneProgram3D(compiled.program,sampleSources);
    try {
      const cargo=stage.nodes.get('saco')!;
      for(const t of [1.1,1.8,2.6,3.7,4.25]){
        stage.update(t);
        expect(stage.nodes.get('saco')).toBe(cargo);
        const d=stage.diagnostics();
        expect(d.maxContactError).toBeLessThan(.09);
      }
      stage.update(5.2);
      expect(stage.nodes.get('saco')).toBe(cargo);
      expect(stage.diagnostics().maxContactError).toBe(0);
    } finally {stage.dispose();}
  });

  it('declines to attach limbs before reaching for the cargo or after releasing it',()=>{
    const compiled=compileStoryMotion(story(),sampleSceneGeometry(),sampleSources,sampleBindings);
    const st=new SceneProgram3D(compiled.program,sampleSources);
    try{
      st.update(.3);
      expect(st.diagnostics().maxContactError).toBe(0);
      st.update(13.5);
      expect(st.diagnostics().maxContactError).toBe(0);
    } finally {st.dispose();}
  });

  it('refuses oversized or impossible author-supplied grip offsets',()=>{
    expect(()=>planGripContacts(story(),sampleSources,sampleBindings.entityNodes,{
      gripOffsets:{saco:{left:[-99,0,0],right:[.2,0,0]}}
    })).toThrow(/Offset de agarrar/);
  });
});
