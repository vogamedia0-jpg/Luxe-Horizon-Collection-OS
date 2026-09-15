import { jsPDF } from 'jspdf';

type PdfProduct = {
  brand?: string | null;
  category: string;
  gender: string;
  images?: { imagePath: string; isPrimary: boolean; sortOrder?: number }[];
};

type PdfOptions = {
  coverImage?: string;
};

type LoadedImage = { data: string; width: number; height: number };

const PAGE_W = 135;
const PAGE_H = 240;
const IMAGE_MAX_SIDE = 1500;
const JPEG_QUALITY = 0.84;

const COLORS = {
  burgundy: '#39080F', burgundyDeep: '#270509', ivory: '#E9DFD2', ivoryLight: '#F4EDE4',
  champagne: '#D5B387', ink: '#080808', muted: '#6D5D54', border: '#C9B7A3',
};

const imageCache = new Map<string, Promise<LoadedImage>>();

const loadOptimizedImage = (src: string, crop?: { width: number; height: number }) => {
  const key = `${src}|${crop?.width || 0}|${crop?.height || 0}`;
  const cached = imageCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Could not load image (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not render image'));
        image.src = objectUrl;
      });
      let width = source.naturalWidth;
      let height = source.naturalHeight;
      let sx = 0; let sy = 0; let sw = width; let sh = height;
      if (crop) {
        const targetRatio = crop.width / crop.height;
        const sourceRatio = width / height;
        if (sourceRatio > targetRatio) { sw = height * targetRatio; sx = (width - sw) / 2; }
        else if (sourceRatio < targetRatio) { sh = width / targetRatio; sy = (height - sh) / 2; }
        width = sw; height = sh;
      }
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create image canvas');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width: canvas.width, height: canvas.height };
    } finally { URL.revokeObjectURL(objectUrl); }
  })();
  imageCache.set(key, promise);
  return promise;
};

const fitContain = (sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) => {
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale; const height = sourceHeight * scale;
  return { width, height, xOffset: (boxWidth - width) / 2, yOffset: (boxHeight - height) / 2 };
};

const formatLiveDate = () => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'long', year: 'numeric',
}).format(new Date()).toUpperCase();

const drawPageBase = (doc: jsPDF) => {
  doc.setFillColor(COLORS.ivory); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
};

const drawContainedImage = async (doc: jsPDF, src: string, x: number, y: number, width: number, height: number) => {
  doc.setFillColor(COLORS.ivoryLight); doc.roundedRect(x, y, width, height, 3, 3, 'F');
  try {
    const image = await loadOptimizedImage(src);
    const fitted = fitContain(image.width, image.height, width, height);
    doc.addImage(image.data, 'JPEG', x + fitted.xOffset, y + fitted.yOffset, fitted.width, fitted.height, undefined, 'FAST');
  } catch {
    doc.setDrawColor(COLORS.border); doc.roundedRect(x, y, width, height, 3, 3, 'S');
  }
};

const drawLogo = async (doc: jsPDF, x: number, y: number, width: number) => {
  try {
    const logo = await loadOptimizedImage('/assets/logo.png');
    const ratio = logo.height / logo.width;
    doc.addImage(logo.data, 'JPEG', x, y, width, width * ratio, undefined, 'FAST');
  } catch {
    doc.setTextColor(COLORS.burgundy); doc.setFont('times', 'normal'); doc.setFontSize(12); doc.text('Luxe horizon', x, y + 5);
  }
};

const drawCover = async (doc: jsPDF, title: string, products: PdfProduct[], publishedDate: string, coverImage: string) => {
  drawPageBase(doc);
  try {
    const hero = await loadOptimizedImage(coverImage, { width: PAGE_W, height: 154 });
    doc.addImage(hero.data, 'JPEG', 0, 0, PAGE_W, 154, undefined, 'FAST');
  } catch { doc.setFillColor(COLORS.burgundyDeep); doc.rect(0, 0, PAGE_W, 154, 'F'); }
  doc.setFillColor(COLORS.burgundyDeep); doc.rect(0, 142, PAGE_W, 98, 'F');
  doc.setTextColor(COLORS.champagne); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
  doc.text(publishedDate, 12, 158, { charSpace: 1.15 });
  doc.setTextColor(COLORS.ivoryLight); doc.setFont('times', 'normal'); doc.setFontSize(27);
  doc.text('New', 12, 177); doc.text('Collection', 12, 191);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor('#E4D8CB');
  doc.text('A live catalogue of our latest arrivals,', 12, 204); doc.text('Updated every few days.', 12, 210);
  doc.setDrawColor(COLORS.champagne); doc.line(12, 217, 42, 217);
  doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(COLORS.ivoryLight);
  doc.text(title, 12, 226, { maxWidth: 82 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor('#D4C5B8');
  doc.text(`${products.length} product${products.length === 1 ? '' : 's'}`, 123, 226, { align: 'right' });
};

const createGenderPdf = async (
  title: string, genderLabel: string, products: PdfProduct[], resolveImage: (path?: string | null) => string,
  coverImage: string, publishedDate: string,
) => {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'portrait', compress: true });
  await drawCover(doc, title, products, publishedDate, coverImage);
  const entries = products.flatMap((product) => {
    const images = [...(product.images || [])].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    return images.map((image) => ({ product, image }));
  });
  for (let index = 0; index < entries.length; index += 1) {
    const { product, image } = entries[index];
    doc.addPage([PAGE_W, PAGE_H], 'portrait'); drawPageBase(doc);
    await drawLogo(doc, 10, 8, 35); doc.setDrawColor(COLORS.border); doc.line(10, 23, 125, 23);
    await drawContainedImage(doc, resolveImage(image.imagePath), 10, 31, 115, 158);
    doc.setTextColor(COLORS.burgundy); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.3);
    doc.text(`${genderLabel.toUpperCase()}  /  ${product.category.toUpperCase()}`, 10, 201, { charSpace: .75 });
    doc.setTextColor(COLORS.ink); doc.setFont('times', 'normal'); doc.setFontSize(23);
    doc.text(product.brand || 'Luxe Horizon', 10, 216, { maxWidth: 96 });
    doc.setDrawColor(COLORS.champagne); doc.line(10, 224, 36, 224);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(COLORS.muted);
    doc.text('LUXE HORIZON / NEW COLLECTION', 10, 233, { charSpace: .65 });
    doc.text(String(index + 1).padStart(2, '0'), 125, 233, { align: 'right' });
  }
  if (entries.length === 0) {
    doc.addPage([PAGE_W, PAGE_H], 'portrait'); drawPageBase(doc); await drawLogo(doc, 12, 12, 38);
    doc.setTextColor(COLORS.burgundy); doc.setFont('times', 'normal'); doc.setFontSize(24); doc.text('Collection coming soon.', 12, 78);
  }
  const safeName = `${title}-${genderLabel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `luxe-horizon-${genderLabel}`;
  doc.save(`${safeName}.pdf`);
};

export async function generateBrandedCataloguePdf(
  title: string, products: PdfProduct[], resolveImage: (path?: string | null) => string, options: PdfOptions = {},
) {
  const publishedDate = formatLiveDate();
  const coverImage = options.coverImage || '/assets/hero.png';
  const men = products.filter((product) => product.gender === 'men');
  const women = products.filter((product) => product.gender === 'women');
  if (men.length > 0) await createGenderPdf(title, "Men's", men, resolveImage, coverImage, publishedDate);
  if (women.length > 0) await createGenderPdf(title, "Women's", women, resolveImage, coverImage, publishedDate);
}
