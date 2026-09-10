import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Loader2, MessageCircle } from 'lucide-react';

type ProductImage = {
  id: string;
  imagePath: string;
  isPrimary: boolean;
  sortOrder: number;
};

type Product = {
  id: string;
  collectionId: string;
  gender: 'men' | 'women' | 'unknown';
  category: string;
  brand?: string | null;
  isActive: boolean;
  isPublished: boolean;
  sortOrder: number;
  images: ProductImage[];
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  publishedAt?: string | null;
};

type CatalogueResponse = {
  collection: Collection | null;
  products: Product[];
  availableBrands: string[];
};

const logo = '/assets/logo.png';
const heroImage = '/assets/hero.png';

const categoryLabels: Record<string, string> = {
  clothing: 'Clothing',
  footwear: 'Footwear',
  watches: 'Watches',
  bags: 'Bags',
  accessories: 'Accessories',
  eyewear: 'Eyewear',
  jewellery: 'Jewellery',
  wallets: 'Wallets & Small Leather Goods',
  belts: 'Belts',
  hats: 'Hats & Caps',
  scarves: 'Scarves',
  other: 'Other',
};

const masterBrands = [
  'Rolex', 'Omega', 'Cartier', 'Patek Philippe', 'Audemars Piguet', 'Richard Mille', 'Hublot',
  'Breitling', 'TAG Heuer', 'Vacheron Constantin', 'Jaeger-LeCoultre', 'IWC', 'Panerai',
  'Chanel', 'Hermès', 'Louis Vuitton', 'Dior', 'Gucci', 'Prada', 'Saint Laurent', 'Bottega Veneta',
  'Celine', 'Fendi', 'Balenciaga', 'Burberry', 'Valentino', 'Versace', 'Givenchy', 'Loewe',
  'Goyard', 'Miu Miu', 'Moncler', 'Loro Piana', 'Brunello Cucinelli', 'Giorgio Armani',
  'Dolce & Gabbana', 'Tom Ford', 'Balmain', 'Alexander McQueen', 'Jacquemus', 'Van Cleef & Arpels',
  'Tiffany & Co.', 'Bvlgari',
];

function imageFor(product?: Product | null) {
  if (!product) return heroImage;
  return product.images?.find((image) => image.isPrimary)?.imagePath || product.images?.[0]?.imagePath || heroImage;
}

function formatPublishedDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(date).toUpperCase();
}

function BrandHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--lh-border)] bg-[rgba(233,223,210,.96)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:h-[78px] sm:px-8 lg:px-10">
        <a href="/catalogue" aria-label="Luxe Horizon catalogue">
          <img src={logo} alt="Luxe Horizon" className="h-11 w-auto object-contain sm:h-12" />
        </a>
        <span className="hidden text-[9px] font-semibold uppercase tracking-[.22em] text-[var(--lh-burgundy)] sm:block">Catalogue</span>
      </div>
    </header>
  );
}

function EmptyState({ error }: { error?: string }) {
  return (
    <div className="mx-auto flex min-h-[46vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <img src={logo} alt="Luxe Horizon" className="h-12 w-auto" />
      <h2 className="mt-7 font-display text-3xl text-[var(--lh-ink)]">No collection is published yet.</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--lh-muted-ink)]">
        {error || 'The catalogue will appear here as soon as a collection is published.'}
      </p>
    </div>
  );
}

type FilterMenuProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  wide?: boolean;
};

function FilterMenu({ label, value, options, open, onToggle, onChange, wide = false }: FilterMenuProps) {
  const selected = options.find((option) => option.value === value)?.label || label;
  return (
    <div className={`relative ${wide ? 'min-w-0 flex-1' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-10 items-center justify-between gap-3 rounded-full border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-4 text-[12px] font-medium text-[var(--lh-ink)] ${wide ? 'w-full' : 'min-w-[152px]'}`}
      >
        <span className="truncate">{selected}</span>
        <ChevronDown size={14} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[46px] z-50 max-h-[340px] w-[min(82vw,320px)] overflow-y-auto rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] p-2 shadow-[0_20px_55px_rgba(57,8,15,.18)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] ${option.value === value ? 'bg-[var(--lh-burgundy)] text-[var(--lh-ivory-light)]' : 'text-[var(--lh-ink)] hover:bg-[var(--lh-ivory-deep)]'}`}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogueList() {
  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gender, setGender] = useState<'all' | 'women' | 'men'>('all');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [openFilter, setOpenFilter] = useState<'category' | 'brand' | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch('/api/catalogue');
        if (!response.ok) throw new Error('Catalogue unavailable');
        const data = (await response.json()) as CatalogueResponse;
        setCatalogue(data);
      } catch {
        setError('The catalogue could not be loaded right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const allBrands = useMemo(() => [...new Set([...masterBrands, ...(catalogue?.availableBrands || [])])].sort((a, b) => a.localeCompare(b)), [catalogue]);

  const visible = useMemo(() => {
    const products = catalogue?.products || [];
    return products
      .filter((product) => gender === 'all' || product.gender === gender)
      .filter((product) => category === 'all' || product.category === category)
      .filter((product) => brand === 'all' || product.brand === brand)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [catalogue, gender, category, brand]);

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center text-[var(--lh-burgundy)]"><Loader2 size={22} className="animate-spin" /></div>;
  }

  if (error || !catalogue?.collection) return <EmptyState error={error} />;

  const publishedDate = formatPublishedDate(catalogue.collection.publishedAt);
  const categoryOptions = [{ value: 'all', label: 'All categories' }, ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))];
  const brandOptions = [{ value: 'all', label: 'All brands' }, ...allBrands.map((item) => ({ value: item, label: item }))];

  return (
    <main>
      <section className="mx-auto max-w-[1320px] px-5 pb-7 pt-6 sm:px-8 sm:pb-10 sm:pt-9 lg:px-10">
        <div className="relative overflow-hidden rounded-[18px] bg-[var(--lh-burgundy)] shadow-[0_20px_65px_rgba(57,8,15,.16)] sm:rounded-[22px]">
          <img src={heroImage} alt="Luxe Horizon New Collection" className="h-[470px] w-full object-cover sm:h-[500px] lg:h-[550px]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(39,5,9,.88)_0%,rgba(39,5,9,.70)_32%,rgba(39,5,9,.12)_68%,rgba(39,5,9,.03)_100%)]" />
          <div className="absolute inset-0 flex items-end p-7 text-[var(--lh-ivory-light)] sm:items-center sm:p-10 lg:p-14">
            <div className="max-w-[520px]">
              {publishedDate && <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[var(--lh-champagne)]">{publishedDate}</p>}
              <h1 className="mt-4 font-display text-[48px] leading-[.98] tracking-[-.035em] sm:text-6xl lg:text-7xl">New<br />Collection</h1>
              <p className="mt-5 max-w-sm text-[13px] leading-6 text-[rgba(244,237,228,.80)]">A live catalogue of our latest arrivals, Updated every few days.</p>
              <a href="#latest-arrivals" className="mt-7 inline-flex h-11 items-center rounded-full bg-[var(--lh-ivory-light)] px-5 text-[11px] font-semibold uppercase tracking-[.10em] text-[var(--lh-burgundy)]">Explore Collection</a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 lg:px-10">
        <div className="sticky top-[72px] z-30 -mx-5 border-y border-[var(--lh-border)] bg-[rgba(233,223,210,.97)] px-5 py-3 backdrop-blur-xl sm:top-[78px] sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex shrink-0 rounded-full border border-[var(--lh-border)] bg-[var(--lh-ivory-deep)] p-1">
              {(['all', 'women', 'men'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`flex-1 rounded-full px-5 py-2 text-[12px] font-semibold transition sm:flex-none ${gender === value ? 'bg-[var(--lh-burgundy)] text-[var(--lh-ivory-light)] shadow-sm' : 'text-[var(--lh-muted-ink)]'}`}
                >
                  {value === 'all' ? 'All' : value === 'women' ? 'Women' : 'Men'}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 gap-2">
              <FilterMenu label="All categories" value={category} options={categoryOptions} open={openFilter === 'category'} onToggle={() => setOpenFilter(openFilter === 'category' ? null : 'category')} onChange={(value) => { setCategory(value); setOpenFilter(null); }} wide />
              <FilterMenu label="All brands" value={brand} options={brandOptions} open={openFilter === 'brand'} onToggle={() => setOpenFilter(openFilter === 'brand' ? null : 'brand')} onChange={(value) => { setBrand(value); setOpenFilter(null); }} wide />
            </div>
          </div>
        </div>

        <div id="latest-arrivals" className="mb-6 mt-9 flex items-end justify-between gap-4 scroll-mt-40 sm:mt-11">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[.20em] text-[var(--lh-burgundy)]">New Collection</p>
            <h2 className="mt-1.5 font-display text-3xl text-[var(--lh-ink)] sm:text-4xl">Latest arrivals</h2>
          </div>
          <span className="pb-1 text-[11px] text-[var(--lh-muted-ink)]">{visible.length} {visible.length === 1 ? 'item' : 'items'}</span>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-5 py-16 text-center text-sm text-[var(--lh-muted-ink)]">No items match these filters.</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4">
            {visible.map((product) => (
              <a key={product.id} href={`/catalogue/product/${product.id}`} className="group block min-w-0">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-[var(--lh-ivory-deep)] sm:rounded-[14px]">
                  <img src={imageFor(product)} alt={product.brand || categoryLabels[product.category] || 'Luxe Horizon product'} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="lazy" />
                </div>
                <div className="px-0.5 pt-3">
                  <p className="truncate text-[13px] font-semibold text-[var(--lh-ink)] sm:text-[14px]">{product.brand || 'Luxe Horizon'}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-[var(--lh-muted-ink)]">{categoryLabels[product.category] || product.category}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ProductDetail({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/catalogue/${encodeURIComponent(productId)}`);
        if (!response.ok) throw new Error('Not found');
        setProduct((await response.json()) as Product);
      } catch {
        setError('This item is not available.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [productId]);

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-[var(--lh-burgundy)]"><Loader2 size={22} className="animate-spin" /></div>;
  if (error || !product) return <EmptyState error={error} />;

  const images = product.images?.length ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder) : [{ id: 'fallback', imagePath: heroImage, isPrimary: true, sortOrder: 0 }];
  const whatsappNumber = (import.meta.env.VITE_LUXE_HORIZON_WHATSAPP || '').replace(/\D/g, '');
  const publicUrl = `${window.location.origin}/catalogue/product/${product.id}`;
  const message = `Hi Luxe Horizon, I'm interested in this item.\n\n${publicUrl}\n\nIs it available?`;
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : '';

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-20 pt-7 sm:px-8 sm:pt-9 lg:px-10 lg:pt-11">
      <a href="/catalogue" className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--lh-burgundy)]"><ArrowLeft size={14} /> Back</a>
      <div className="grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-12">
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-[16px] bg-[var(--lh-ivory-deep)] sm:rounded-[20px]">
            <img src={images[activeImage]?.imagePath || heroImage} alt={product.brand || categoryLabels[product.category] || 'Luxe Horizon product'} className="h-full w-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button key={image.id} type="button" onClick={() => setActiveImage(index)} className={`h-16 w-14 shrink-0 overflow-hidden rounded-lg border ${activeImage === index ? 'border-[var(--lh-burgundy)]' : 'border-transparent'}`}>
                  <img src={image.imagePath} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-28 lg:self-start lg:pt-5">
          <p className="text-[9px] font-semibold uppercase tracking-[.20em] text-[var(--lh-burgundy)]">{categoryLabels[product.category] || product.category}</p>
          <h1 className="mt-2 font-display text-5xl leading-tight text-[var(--lh-ink)] sm:text-6xl">{product.brand || 'Luxe Horizon'}</h1>
          <div className="mt-7 h-px bg-[var(--lh-border)]" />
          <p className="mt-6 max-w-md text-sm leading-7 text-[var(--lh-muted-ink)]">For availability and details, enquire directly on WhatsApp.</p>
          {whatsappHref ? (
            <a data-testid="link-whatsapp-enquiry" href={whatsappHref} target="_blank" rel="noreferrer" className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lh-burgundy)] px-6 text-[12px] font-semibold text-[var(--lh-ivory-light)] transition hover:bg-[var(--lh-burgundy-soft)] sm:w-auto sm:min-w-[230px]">
              <MessageCircle size={16} /> Enquire on WhatsApp
            </a>
          ) : (
            <p className="mt-7 rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] p-4 text-xs text-[var(--lh-muted-ink)]">WhatsApp enquiry is not configured yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PublicCatalogue() {
  const path = window.location.pathname;
  const productMatch = path.match(/^\/catalogue\/product\/([^/]+)$/);

  return (
    <div className="min-h-[100dvh] bg-[var(--lh-ivory)] text-[var(--lh-ink)]">
      <BrandHeader />
      {productMatch ? <ProductDetail productId={decodeURIComponent(productMatch[1])} /> : <CatalogueList />}
      <footer className="border-t border-[var(--lh-border)] px-5 py-10 text-center">
        <img src={logo} alt="Luxe Horizon" className="mx-auto h-11 w-auto object-contain" />
      </footer>
    </div>
  );
}
