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

const COLORS = {
  burgundy: '#642536',
  burgundyDeep: '#4D1D2A',
  ivory: '#F3EEE6',
  ivoryLight: '#FAF6F0',
  champagne: '#D8B87F',
  ink: '#241B18',
  muted: '#806B61',
  border: '#D8CBBF',
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
  return {
    data,
    format: blob.type.includes('png') ? 'PNG' : 'JPEG',
    ...dimensions,
  };
};

const fitContain = (sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) => {
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { width, height, xOffset: (boxWidth - width) / 2, yOffset: (boxHeight - height) / 2 };
};

const fitCover = (sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) => {
  const scale = Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
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
  doc.rect(0, 0, 210, 297, 'F');
};

const drawProductImage = async (
  doc: jsPDF,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  doc.setFillColor(COLORS.ivoryLight);
  doc.roundedRect(x, y, width, height, 2.2, 2.2, 'F');
  try {
    const image = await imageDataUrl(src);
    const fitted = fitContain(image.width, image.height, width - 4, height - 4);
    doc.addImage(
      image.data,
      image.format,
      x + 2 + fitted.xOffset,
      y + 2 + fitted.yOffset,
      fitted.width,
      fitted.height,
      undefined,
      'NONE',
    );
  } catch {
    doc.setDrawColor(COLORS.border);
    doc.roundedRect(x, y, width, height, 2.2, 2.2, 'S');
  }
};

export async function generateBrandedCataloguePdf(
  title: string,
  products: PdfProduct[],
  resolveImage: (path?: string | null) => string,
  options: PdfOptions = {},
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  const coverImage = options.coverImage || '/assets/brand-board.png';
  const publishedAt = await getLivePublishedAt(options.publishedAt);
  const publishedDate = formatPublishedDate(publishedAt);

  // COVER — fixed Luxe Horizon composition, with the live collection publication date.
  drawPageBase(doc);
  doc.setFillColor(COLORS.burgundyDeep);
  doc.roundedRect(10, 13, 190, 271, 4, 4, 'F');

  try {
    const hero = await imageDataUrl(coverImage);
    const boxX = 98;
    const boxY = 13;
    const boxW = 102;
    const boxH = 271;
    const fitted = fitCover(hero.width, hero.height, boxW, boxH);
    const canvas = document.createElement('canvas');
    const pixelScale = 2;
    canvas.width = Math.round(boxW * 5 * pixelScale);
    canvas.height = Math.round(boxH * 5 * pixelScale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const source = new Image();
      await new Promise<void>((resolve, reject) => {
        source.onload = () => resolve();
        source.onerror = () => reject(new Error('Cover image could not be rendered'));
        source.src = hero.data;
      });
      const scale = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
      const drawW = source.naturalWidth * scale;
      const drawH = source.naturalHeight * scale;
      ctx.drawImage(source, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
      doc.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', boxX, boxY, boxW, boxH, undefined, 'NONE');
    } else {
      doc.addImage(hero.data, hero.format, boxX, boxY, fitted.width, fitted.height, undefined, 'NONE');
    }
  } catch {
    doc.setFillColor(COLORS.burgundy);
    doc.rect(98, 13, 102, 271, 'F');
  }

  doc.setFillColor(COLORS.burgundyDeep);
  doc.rect(10, 13, 96, 271, 'F');
  doc.setTextColor(COLORS.ivoryLight);
  if (publishedDate) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(publishedDate, 24, 67, { charSpace: 1.6 });
  }
  doc.setFont('times', 'normal');
  doc.setFontSize(37);
  doc.text('New', 23, 101);
  doc.text('Collection', 23, 127);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor('#EADFD3');
  doc.text('A live catalogue of our latest arrivals,', 24, 150);
  doc.text('updated every few days.', 24, 157);
  doc.setDrawColor(COLORS.champagne);
  doc.line(24, 171, 58, 171);
  doc.setTextColor(COLORS.ivoryLight);
  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(title, 24, 190, { maxWidth: 62 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor('#D8C9BF');
  doc.text(`${products.length} product${products.length === 1 ? '' : 's'}`, 24, 211);
  doc.setTextColor(COLORS.champagne);
  doc.setFontSize(7);
  doc.text('LUXE HORIZON', 24, 264, { charSpace: 1.2 });
  doc.setTextColor('#D8C9BF');
  doc.text('The pinnacle of luxury shopping.', 24, 271);

  // Use the original uploaded product files exactly as stored. They are never AI-generated,
  // retouched or cropped by the PDF generator; contain-fit preserves the whole source image.
  const entries = products.flatMap((product) => {
    const images = [...(product.images || [])].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    return images.map((image) => ({ product, image }));
  });

  // Exactly two product photos per page for comfortable viewing.
  for (let index = 0; index < entries.length; index += 2) {
    doc.addPage();
    drawPageBase(doc);

    doc.setTextColor(COLORS.burgundy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text('LUXE HORIZON  /  NEW COLLECTION', 16, 16, { charSpace: 1.05 });
    doc.setDrawColor(COLORS.border);
    doc.line(16, 21, 194, 21);

    const pageEntries = entries.slice(index, index + 2);
    for (let slot = 0; slot < pageEntries.length; slot += 1) {
      const { product, image } = pageEntries[slot];
      const x = slot === 0 ? 16 : 108;
      const imageY = 32;
      const imageW = 86;
      const imageH = 205;
      await drawProductImage(doc, resolveImage(image.imagePath), x, imageY, imageW, imageH);

      doc.setTextColor(COLORS.ink);
      doc.setFont('times', 'normal');
      doc.setFontSize(15);
      doc.text(product.brand || 'Luxe Horizon', x, 249, { maxWidth: imageW });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(COLORS.muted);
      doc.text(`${product.gender.toUpperCase()}  /  ${product.category.toUpperCase()}`, x, 257, { charSpace: .4 });
      doc.setDrawColor(COLORS.champagne);
      doc.line(x, 265, x + 24, 265);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(COLORS.muted);
    doc.text(String(Math.floor(index / 2) + 1).padStart(2, '0'), 194, 284, { align: 'right' });
  }

  if (entries.length === 0) {
    doc.addPage();
    drawPageBase(doc);
    doc.setTextColor(COLORS.burgundy);
    doc.setFont('times', 'normal');
    doc.setFontSize(24);
    doc.text('Collection coming soon.', 24, 74);
  }

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'luxe-horizon-catalogue';
  doc.save(`${safeName}.pdf`);
}
