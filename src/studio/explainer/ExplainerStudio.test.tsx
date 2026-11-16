import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplainerStudio } from './ExplainerStudio';
import { buildFallbackPlan } from './plan';
import { getNarration } from './voice';

vi.mock('./voice', () => ({
  NARRATION_VOICES: [{ id: 'Algieba', label: 'Voz de teste' }],
  getNarration: vi.fn(),
  getCachedNarration: vi.fn(async () => null),
  speechBounds: () => ({ start: 0, end: 2 }),
}));
vi.mock('./render', () => ({ drawExplainerFrame: vi.fn(), drawOverlay: vi.fn() }));
vi.mock('./toon3d', () => ({ Toon3D: class {} }));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('AudioContext', class {
    resume = vi.fn();
    createBuffer = vi.fn();
    createBufferSource = () => ({ connect: vi.fn(), start: vi.fn() });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.mocked(getNarration).mockReset(); });

function saved() {
  const plan = { ...buildFallbackPlan('Primeira cena. Segunda cena.'), engine: '2d' as const };
  for (const s of plan.scenes) s.voice = { duration: 2, start: 0, end: 2 };
  localStorage.setItem('stickstory-projects-v1', JSON.stringify([
    { id: 'saved', title: plan.title, script: 'Primeira cena. Segunda cena.', plan, updatedAt: 1 },
  ]));
}
const mount = () => render(<ExplainerStudio onOpenEditor={() => {}} onOpenVideo={() => {}} />);

describe('project narration recovery', () => {
  it('offers voice generation on reopen even when narration timing was saved', () => {
    saved(); mount();
    expect(screen.getByRole('button', { name: 'Gerar voz' })).toBeEnabled();
    expect(getNarration).not.toHaveBeenCalled(); // reopening never triggers a billable request
  });

  it('keeps the first successful clip when the next TTS request fails', async () => {
    saved();
    vi.mocked(getNarration)
      .mockResolvedValueOnce({ duration: 2 } as AudioBuffer)
      .mockRejectedValueOnce(new Error('Voz indisponível.'));
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Gerar voz' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Voz disponível em 1 de 2 cenas'));
    expect(screen.getByRole('button', { name: 'Gerar voz' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Baixar vídeo' })).toBeEnabled();
  });

  it('saves the selected 3D engine after generating a fresh plan', async () => {
    const plan = buildFallbackPlan('Novo roteiro.');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('feedback') ? {} : { plan, source: 'ai' })));
    mount();
    fireEvent.change(screen.getByLabelText('Roteiro / narração'), { target: { value: 'Novo roteiro.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Com narração' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar animação' }));
    await waitFor(() => {
      const projects = JSON.parse(localStorage.getItem('stickstory-projects-v1') || '[]');
      expect(projects[0]?.plan.engine).toBe('3d');
    }, { timeout: 2000 });
  });
});


describe('opt-in real-studio free-form 3D', () => {
  it('exposes 3D program mode but never makes a Gemini request on mode selection', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      plan: buildFallbackPlan('Uma máquina monta suas peças.'),
      source: 'ai', provider: 'gemini',
    }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    const studio = screen.getByRole('button', { name: /3D livre.*Gemini direto/i });
    fireEvent.click(studio);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Roteiro / narração'), { target: { value: 'Uma máquina monta suas peças.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Programar 3D com Gemini' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/explainer-plan');
    expect(JSON.parse(String(request.body))).toMatchObject({
      mode: 'program', engine: '3d', script: 'Uma máquina monta suas peças.',
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/A IA não forneceu uma cena 3D programável/));
    expect(getNarration).not.toHaveBeenCalled();
  });
  it('hides the experimental 3D option after switching to Motion 2D', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /3D livre.*Gemini direto/i }));
    fireEvent.click(screen.getByRole('button', { name: /Motion 2D/i }));
    expect(screen.queryByRole('button', { name: /3D livre.*Gemini direto/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar animação' })).toBeDisabled(); // No script entered in this test.
  });
});

describe('explicit generation costs', () => {
  it('does not trigger Lovable narration after direct Gemini direction', async () => {
    const plan = buildFallbackPlan('Um novo roteiro.');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('feedback') ? {} : { plan, source: 'ai', provider: 'gemini' })));
    mount();
    fireEvent.change(screen.getByLabelText('Roteiro / narração'), { target: { value: 'Um novo roteiro.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar animação' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('narração é uma etapa separada'));
    expect(getNarration).not.toHaveBeenCalled();
  });
  it('creates an explicitly local plan without an AI or TTS request', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.change(screen.getByLabelText('Roteiro / narração'), { target: { value: 'Uma frase original. Outra frase inteira.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar sem IA' }));
    expect(screen.getByRole('status')).toHaveTextContent('sem IA e sem narração');
    expect(screen.getByLabelText('Texto da cena 2')).toHaveValue('Outra frase inteira.');
    expect(fetchMock).not.toHaveBeenCalled(); expect(getNarration).not.toHaveBeenCalled();
  });
  it('preserves the previous scenes and new script when the direction gateway returns HTML', async () => {
    const fetchMock = vi.fn(async () => new Response('<!DOCTYPE html><html>private-error-detail</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetchMock);
    saved(); mount();
    fireEvent.change(screen.getByLabelText('Roteiro / narração'), { target: { value: 'Eu sou o maior jogador do mundo hahahaha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar animação' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('HTTP 502'));
    expect(screen.getByLabelText('Texto da cena 1')).toHaveValue('Primeira cena.');
    expect(screen.getByLabelText('Roteiro / narração')).toHaveValue('Eu sou o maior jogador do mundo hahahaha');
    expect(screen.getByRole('status')).not.toHaveTextContent('private-error-detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getNarration).not.toHaveBeenCalled();
  });
});
