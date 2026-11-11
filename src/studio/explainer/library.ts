// Device-local library: every project autosaves here, and favourite AI drawings become a reusable gallery.
import type { ExplainerPlan } from './plan';
import type { Shape } from './drawing';

export interface SavedProject { id: string; title: string; script: string; plan: ExplainerPlan; updatedAt: number }
export interface GalleryItem { id: string; name: string; drawing: Shape[] }

const P = 'stickstory-projects-v1', G = 'stickstory-gallery-v1';
const read = <T,>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const listProjects = () => read<SavedProject>(P).sort((a, b) => b.updatedAt - a.updatedAt);
export function saveProject(p: SavedProject) {
  // Uploaded narration is not stored, so saved timing must not claim a track.
  const plan = { ...p.plan, track: undefined, scenes: p.plan.track ? p.plan.scenes.map(({ voice: _v, ...s }) => s) : p.plan.scenes };
  write(P, [{ ...p, plan }, ...listProjects().filter((x) => x.id !== p.id)].slice(0, 50));
}
export const deleteProject = (id: string) => write(P, listProjects().filter((x) => x.id !== id));

export const listGallery = () => read<GalleryItem>(G);
export function addToGallery(name: string, drawing: Shape[]) {
  const item = { id: `g${Date.now().toString(36)}`, name: name.slice(0, 60), drawing };
  write(G, [item, ...listGallery()].slice(0, 40));
  return item;
}
export const removeFromGallery = (id: string) => write(G, listGallery().filter((x) => x.id !== id));
