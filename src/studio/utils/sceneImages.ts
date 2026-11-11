const images = new Map<string, HTMLImageElement>();
export function getSceneImage(url: string) {
  let image = images.get(url);
  if (!image) {
    image = new Image(); image.src = url;
    images.set(url, image);
    if (images.size > 8) { const oldest = images.keys().next().value; if (oldest) images.delete(oldest); }
  }
  return image;
}