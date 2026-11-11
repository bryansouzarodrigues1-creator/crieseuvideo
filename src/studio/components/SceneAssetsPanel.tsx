import { useRef, useState } from 'react';
import { Box, ImagePlus, Upload, X, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import robot from '@/assets/models/expressive-robot.glb.asset.json';
import { validateGlb } from '../utils/assetValidation';
import type { StickmanScene } from '../types/stickman';

const robotAnimations = ['Dance', 'Death', 'Idle', 'Jump', 'No', 'Punch', 'Running', 'Sitting', 'Standing', 'ThumbsUp', 'Walking', 'WalkJump', 'Wave', 'Yes'];

export function SceneAssetsPanel({ scene, onUpdate }: { scene: StickmanScene; onUpdate: (update: Partial<StickmanScene>) => void }) {
  const modelInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function importModel(file?: File) {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const buffer = await file.arrayBuffer();
      const animations = validateGlb(buffer);
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Falha ao ler o arquivo.'));
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      onUpdate({ importedModel: { url, name: file.name, animations, animation: animations[0] || '', rotation: 0, scale: 1 } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao importar.'); }
    finally { setLoading(false); }
  }
  function importImage(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Selecione uma imagem PNG, JPG ou WebP.'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') onUpdate({ backgroundImage: { url: reader.result, name: file.name } }); };
    reader.readAsDataURL(file);
  }
  const model = scene.importedModel;
  const title = scene.liveTitle ?? { text: scene.title, enabled: false, style: 'clean' as const };
  return <section className="scene-assets border-b border-border bg-background px-4 py-3 text-foreground">
    <div className="flex flex-wrap items-center gap-2">
      <Box className="size-4 text-primary" /><h2 className="mr-auto text-xs font-semibold">Elenco & composição</h2>
      <Button size="sm" variant="secondary" onClick={() => { setError(''); onUpdate({ importedModel: { url: robot.url, name: 'Robô expressivo', animations: robotAnimations, animation: 'Dance', rotation: 0, scale: 1 } }); }}><Box />Robô</Button>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => modelInput.current?.click()}><Upload />{loading ? 'Importando…' : 'GLB'}</Button>
      <Button size="sm" variant="outline" onClick={() => imageInput.current?.click()}><ImagePlus />Imagem</Button>
      <input ref={modelInput} aria-label="Importar modelo GLB" className="hidden" type="file" accept=".glb" onChange={e => { void importModel(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={imageInput} aria-label="Importar imagem de fundo" className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { importImage(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
    {model && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      <span className="max-w-40 truncate font-medium">{model.name}</span>
      <select aria-label="Animação do modelo" className="min-w-0 rounded-md border border-input bg-secondary p-1.5" value={model.animation} onChange={e => onUpdate({ importedModel: { ...model, animation: e.target.value } })}><option value="">Pose original</option>{model.animations.map(name => <option key={name}>{name}</option>)}</select>
      <label className="flex items-center gap-2">Rotação<input aria-label="Rotação do modelo" type="range" min="-180" max="180" value={model.rotation} onChange={e => onUpdate({ importedModel: { ...model, rotation: Number(e.target.value) } })} className="w-20 accent-primary" /></label>
      <label className="flex items-center gap-2">Escala<input aria-label="Escala do modelo" type="range" min="0.25" max="1.5" step="0.05" value={model.scale} onChange={e => onUpdate({ importedModel: { ...model, scale: Number(e.target.value) } })} className="w-20 accent-primary" /></label>
      <Button variant="ghost" size="icon" title="Remover modelo" onClick={() => onUpdate({ importedModel: undefined })}><X /></Button>
    </div>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Type className="size-4 text-muted-foreground" />
      <input aria-label="Título ao vivo" className="min-w-0 flex-1 basis-40 rounded-md border border-input bg-secondary px-2 py-1.5 text-xs" value={title.text} onChange={e => onUpdate({ liveTitle: { ...title, text: e.target.value } })} />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={title.enabled} onChange={e => onUpdate({ liveTitle: { ...title, enabled: e.target.checked } })} />Título</label>
      <select aria-label="Estilo do título" className="rounded-md border border-input bg-secondary p-1.5 text-xs" value={title.style} onChange={e => onUpdate({ liveTitle: { ...title, style: e.target.value === 'editorial' ? 'editorial' : 'clean' } })}><option value="clean">Essencial</option><option value="editorial">Editorial</option></select>
      {scene.backgroundImage && <Button size="sm" variant="ghost" title="Remover imagem" onClick={() => onUpdate({ backgroundImage: undefined })}><X />Fundo</Button>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </section>;
}