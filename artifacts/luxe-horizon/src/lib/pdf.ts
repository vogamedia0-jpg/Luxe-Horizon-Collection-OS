import { jsPDF } from 'jspdf';

type PdfProduct = {
  brand?: string | null;
  category: string;
  gender: string;
  images?: { imagePath: string; isPrimary: boolean; sortOrder?: number }[];
};

type PdfOptions = {
  publishedAt?: string | null;
  coverImage?: string;
};

type LoadedImage = {
  data: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
};

const PAGE_W = 135;
const PAGE_H = 240;

const COLORS = {
  burgundy: '#39080F',
  burgundyDeep: '#270509',
  ivory: '#E9DFD2',
  ivoryLight: '#F4EDE4',
  champagne: '#D5B387',
  ink: '#080808',
  muted: '#6D5D54',
  border: '#C9B7A3',
};

const imageDataUrl = async (src: string): Promise<LoadedImage> => {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not load image (${response.status})`);
  const blob = await response.blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Could not read image dimensions'));
    image.src = data;
  });
  return { data, format: blob.type.includes('png') ? 'PNG' : 'JPEG', ...dimensions };
};

const fitContain = (sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) => {
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { width, height, xOffset: (boxWidth - width) / 2, yOffset: (boxHeight - height) / 2 };
};

const cropToCanvas = async (image: LoadedImage, targetWidth: number, targetHeight: number) => {
  const source = new Image();
  await new Promise<void>((resolve, reject) => {
    source.onload = () => resolve();
    source.onerror = () => reject(new Error('Image could not be rendered'));
    source.src = image.data;
  });
  const canvas = document.createElement('canvas');
  const scaleFactor = 5;
  canvas.width = Math.round(targetWidth * scaleFactor);
  canvas.height = Math.round(targetHeight * scaleFactor);
  const ctx = canvas.getContext('2d');
  if (!ctx) return image.data;
  const scale = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
  const drawW = source.naturalWidth * scale;
  const drawH = source.naturalHeight * scale;
  ctx.drawImage(source, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
  return canvas.toDataURL('image/jpeg', .97);
};

const formatPublishedDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(date).toUpperCase();
};

const getLivePublishedAt = async (fallback?: string | null) => {
  if (fallback) return fallback;
  try {
    const response = await fetch('/api/catalogue');
    if (!response.ok) return null;
    const data = await response.json() as { collection?: { publishedAt?: string | null } | null };
    return data.collection?.publishedAt || null;
  } catch {
    return null;
  }
};

const drawPageBase = (doc: jsPDF) => {
  doc.setFillColor(COLORS.ivory);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
};

const drawContainedImage = async (doc: jsPDF, src: string, x: number, y: number, width: number, height: number) => {
  doc.setFillColor(COLORS.ivoryLight);
  doc.roundedRect(x, y, width, height, 3, 3, 'F');
  try {
    const image = await imageDataUrl(src);
    const fitted = fitContain(image.width, image.height, width, height);
    doc.addImage(
      image.data,
      image.format,
      x + fitted.xOffset,
      y + fitted.yOffset,
      fitted.width,
      fitted.height,
      undefined,
      'NONE',
    );
  } catch {
    doc.setDrawColor(COLORS.border);
    doc.roundedRect(x, y, width, height, 3, 3, 'S');
  }
};

const drawLogo = async (doc: jsPDF, x: number, y: number, width: number) => {
  try {
    const logo = await imageDataUrl('/assets/logo.png');
    const ratio = logo.height / logo.width;
    doc.addImage(logo.data, logo.format, x, y, width, width * ratio, undefined, 'NONE');
  } catch {
    doc.setTextColor(COLORS.burgundy);
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text('Luxe horizon', x, y + 5);
  }
};

export async function generateBrandedCataloguePdf(
  title: string,
  products: PdfProduct[],
  resolveImage: (path?: string | null) => string,
  options: PdfOptions = {},
) {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'portrait', compress: false });
  const publishedAt = await getLivePublishedAt(options.publishedAt);
  const publishedDate = formatPublishedDate(publishedAt);
  const coverImage = options.coverImage || '/assets/hero.png';

  // Digital-first 9:16 cover for phone sharing.
  drawPageBase(doc);
  try {
    const hero = await imageDataUrl(coverImage);
    const cropped = await cropToCanvas(hero, PAGE_W, 154);
    doc.addImage(cropped, 'JPEG', 0, 0, PAGE_W, 154, undefined, 'NONE');
  } catch {
    doc.setFillColor(COLORS.burgundyDeep);
    doc.rect(0, 0, PAGE_W, 154, 'F');
  }

  doc.setFillColor(COLORS.burgundyDeep);
  doc.rect(0, 142, PAGE_W, 98, 'F');
  doc.setTextColor(COLORS.champagne);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  if (publishedDate) doc.text(publishedDate, 12, 158, { charSpace: 1.15 });

  doc.setTextColor(COLORS.ivoryLight);
  doc.setFont('times', 'normal');
  doc.setFontSize(27);
  doc.text('New', 12, 177);
  doc.text('Collection', 12, 191);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor('#E4D8CB');
  doc.text('A live catalogue of our latest arrivals,', 12, 204);
  doc.text('Updated every few days.', 12, 210);

  doc.setDrawColor(COLORS.champagne);
  doc.line(12, 217, 42, 217);

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(COLORS.ivoryLight);
  doc.text(title, 12, 226, { maxWidth: 82 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor('#D4C5B8');
  doc.text(`${products.length} product${products.length === 1 ? '' : 's'}`, 123, 226, { align: 'right' });

  const entries = products.flatMap((product) => {
    const images = [...(product.images || [])].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    return images.map((image) => ({ product, image }));
  });

  for (let index = 0; index < entries.length; index += 1) {
    const { product, image } = entries[index];
    doc.addPage([PAGE_W, PAGE_H], 'portrait');
    drawPageBase(doc);

    await drawLogo(doc, 10, 8, 35);
    doc.setDrawColor(COLORS.border);
    doc.line(10, 23, 125, 23);

    await drawContainedImage(doc, resolveImage(image.imagePath), 10, 31, 115, 158);

    doc.setTextColor(COLORS.burgundy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.text(`${product.gender.toUpperCase()}  /  ${product.category.toUpperCase()}`, 10, 201, { charSpace: .75 });

    doc.setTextColor(COLORS.ink);
    doc.setFont('times', 'normal');
    doc.setFontSize(23);
    doc.text(product.brand || 'Luxe Horizon', 10, 216, { maxWidth: 96 });

    doc.setDrawColor(COLORS.champagne);
    doc.line(10, 224, 36, 224);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(COLORS.muted);
    doc.text('LUXE HORIZON / NEW COLLECTION', 10, 233, { charSpace: .65 });
    doc.text(String(index + 1).padStart(2, '0'), 125, 233, { align: 'right' });
  }

  if (entries.length === 0) {
    doc.addPage([PAGE_W, PAGE_H], 'portrait');
    drawPageBase(doc);
    await drawLogo(doc, 12, 12, 38);
    doc.setTextColor(COLORS.burgundy);
    doc.setFont('times', 'normal');
    doc.setFontSize(24);
    doc.text('Collection coming soon.', 12, 78);
  }

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'luxe-horizon-catalogue';
  doc.save(`${safeName}.pdf`);
}
