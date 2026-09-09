import { jsPDF } from 'jspdf';

type PdfProduct = {
  brand?: string | null;
  category: string;
  gender: string;
  images?: { imagePath: string; isPrimary: boolean }[];
};

const imageDataUrl = async (src: string) => {
  const response = await fetch(src);
  const blob = await response.blob();
  return new Promise<{ data: string; format: 'PNG' | 'JPEG' }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      data: String(reader.result),
      format: blob.type.includes('png') ? 'PNG' : 'JPEG',
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export async function generateBrandedCataloguePdf(
  title: string,
  products: PdfProduct[],
  resolveImage: (path?: string | null) => string,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const burgundy = '#642536';
  const ivory = '#F3EEE6';
  const champagne = '#D8B87F';

  doc.setFillColor(ivory);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(burgundy);
  doc.rect(0, 0, 210, 12, 'F');
  doc.setTextColor(burgundy);
  doc.setFont('times', 'italic');
  doc.setFontSize(34);
  doc.text('Luxe horizon', 22, 82);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#806B61');
  doc.text('The pinnacle of luxury shopping', 23, 92);
  doc.setDrawColor(champagne);
  doc.line(23, 104, 78, 104);
  doc.setFontSize(14);
  doc.setTextColor('#241B18');
  doc.text(title, 23, 124);
  doc.setFontSize(9);
  doc.setTextColor('#806B61');
  doc.text(`${products.length} pieces · Private edit`, 23, 133);
  doc.setFontSize(8);
  doc.text('Prepared for personal sharing through WhatsApp', 23, 270);
  doc.setTextColor(burgundy);
  doc.text('LUXE HORIZON', 23, 278);

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    if (index % 2 === 0) {
      doc.addPage();
      doc.setFillColor(ivory);
      doc.rect(0, 0, 210, 297, 'F');
    }
    const column = index % 2;
    const x = column === 0 ? 18 : 111;
    const y = 24;
    const imagePath = product.images?.find((image) => image.isPrimary)?.imagePath || product.images?.[0]?.imagePath;
    try {
      if (imagePath) {
        const image = await imageDataUrl(resolveImage(imagePath));
        doc.addImage(image.data, image.format, x, y, 80, 104, undefined, 'FAST');
      }
    } catch {
      doc.setFillColor('#E3D8CB');
      doc.rect(x, y, 80, 104, 'F');
    }
    doc.setTextColor(burgundy);
    doc.setFont('times', 'normal');
    doc.setFontSize(16);
    doc.text(product.brand || 'Luxe Horizon edit', x, 144);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#806B61');
    doc.setFontSize(8);
    doc.text(`${product.gender.toUpperCase()} · ${product.category.toUpperCase()}`, x, 151);
    doc.setDrawColor('#D5C7B9');
    doc.line(x, 158, x + 38, 158);
  }

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'luxe-horizon-catalogue';
  doc.save(`${safeName}.pdf`);
}