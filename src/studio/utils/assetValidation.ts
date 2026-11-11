export function validateGlb(buffer: ArrayBuffer): string[] {
  if (buffer.byteLength < 20) throw new Error('Arquivo GLB incompleto.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) {
    throw new Error('Selecione um modelo GLB válido (glTF 2.0).');
  }
  const size = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || size > buffer.byteLength - 20) throw new Error('Estrutura GLB inválida.');
  const meta = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + size)));
  if ((meta.extensionsRequired ?? []).some((ext: string) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(ext))) {
    throw new Error('Exporte o GLB sem compressão Draco, Meshopt ou KTX2.');
  }
  if ([...(meta.buffers ?? []), ...(meta.images ?? [])].some((item: { uri?: string }) => item.uri && !item.uri.startsWith('data:'))) {
    throw new Error('O GLB deve incluir suas texturas e arquivos internamente.');
  }
  return (meta.animations ?? []).map((clip: { name?: string }, index: number) => clip.name || `Animação ${index + 1}`);
}