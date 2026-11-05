(function (root) {
  const SIZES = { wallpaper: 1920, cover: 600, avatar: 256 };

  async function resize(file, maxPx) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      throw new Error('Não foi possível abrir essa imagem.');
    }
    const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/webp', 0.85);
  }

  const api = { resize, SIZES };
  root.App = root.App || {};
  root.App.images = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
