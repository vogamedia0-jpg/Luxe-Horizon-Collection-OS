import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Loader2, MessageCircle } from 'lucide-react';

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
  category: 'clothing' | 'footwear' | 'watches' | 'bags' | 'accessories' | 'other';
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
  other: 'Other',
};

function imageFor(product?: Product | null) {
  if (!product) return heroImage;
  return product.images?.find((image) => image.isPrimary)?.imagePath || product.images?.[0]?.imagePath || heroImage;
}

function BrandHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#d7cabd]/80 bg-[#f5f0e9]/94 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-4 sm:h-[74px] sm:px-7 lg:px-10">
        <a href="/catalogue" aria-label="Luxe Horizon catalogue">
          <img src={logo} alt="Luxe Horizon" className="h-9 w-auto object-contain sm:h-10" />
        </a>
        <span className="hidden font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#78535a] sm:block">Catalogue</span>
      </div>
    </header>
  );
}

function EmptyState({ error }: { error?: string }) {
  return (
    <div className="mx-auto flex min-h-[46vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <img src={logo} alt="Luxe Horizon" className="h-10 w-auto opacity-80" />
      <h2 className="mt-7 font-display text-3xl text-[#3b2529]">No collection is published yet.</h2>
      <p className="mt-3 text-sm leading-6 text-[#806d68]">
        {error || 'The catalogue will appear here as soon as a collection is published.'}
      </p>
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

  const visible = useMemo(() => {
    const products = catalogue?.products || [];
    return products
      .filter((product) => gender === 'all' || product.gender === gender)
      .filter((product) => category === 'all' || product.category === category)
      .filter((product) => brand === 'all' || product.brand === brand)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [catalogue, gender, category, brand]);

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center text-[#6b2734]"><Loader2 size={22} className="animate-spin" /></div>;
  }

  if (error || !catalogue?.collection) return <EmptyState error={error} />;

  return (
    <main>
      <section className="mx-auto max-w-[1320px] px-4 pb-6 pt-5 sm:px-7 sm:pb-9 sm:pt-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[18px] bg-[#6b2734] shadow-[0_20px_65px_rgba(69,26,36,.12)] sm:rounded-[22px]">
          <img src={heroImage} alt="Luxe Horizon" className="h-[300px] w-full object-cover sm:h-[440px] lg:h-[520px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#321519]/75 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-[#fffaf3] sm:p-8 lg:p-10">
            <p className="font-mono-ui text-[9px] uppercase tracking-[.22em] text-[#ead5ba]">Luxe Horizon</p>
            <h1 className="mt-2 max-w-2xl font-display text-[32px] leading-[1.03] sm:text-5xl lg:text-6xl">{catalogue.collection.name}</h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-4 pb-20 sm:px-7 lg:px-10">
        <div className="sticky top-[68px] z-20 -mx-4 border-y border-[#d7cabd]/80 bg-[#f5f0e9]/96 px-4 py-3 backdrop-blur-xl sm:top-[74px] sm:mx-0 sm:rounded-xl sm:border sm:px-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 rounded-full border border-[#cdbbb1] bg-[#eee5dc] p-1">
              {(['all', 'women', 'men'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${gender === value ? 'bg-[#6b2734] text-[#fffaf3] shadow-sm' : 'text-[#644d49]'}`}
                >
                  {value === 'all' ? 'All' : value === 'women' ? 'Women' : 'Men'}
                </button>
              ))}
            </div>

            <label className="relative shrink-0">
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 appearance-none rounded-full border border-[#cdbbb1] bg-[#f8f3ed] pl-3 pr-8 text-[11px] font-medium text-[#543d3c] outline-none focus:border-[#6b2734]">
                <option value="all">All categories</option>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#765f59]" />
            </label>

            <label className="relative shrink-0">
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-9 max-w-[150px] appearance-none rounded-full border border-[#cdbbb1] bg-[#f8f3ed] pl-3 pr-8 text-[11px] font-medium text-[#543d3c] outline-none focus:border-[#6b2734]">
                <option value="all">All brands</option>
                {(catalogue.availableBrands || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#765f59]" />
            </label>
          </div>
        </div>

        <div className="mb-5 mt-7 flex items-end justify-between gap-4 sm:mt-10">
          <div>
            <p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#8a6065]">New Collection</p>
            <h2 className="mt-1.5 font-display text-2xl text-[#342324] sm:text-3xl">Latest arrivals</h2>
          </div>
          <span className="pb-1 text-[11px] text-[#8a746d]">{visible.length} {visible.length === 1 ? 'item' : 'items'}</span>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-[#daccc0] bg-[#f8f3ed] px-5 py-16 text-center text-sm text-[#806d68]">No items match these filters.</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-9 lg:grid-cols-4">
            {visible.map((product) => (
              <a key={product.id} href={`/catalogue/product/${product.id}`} className="group block min-w-0">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-[#e5d9ce] sm:rounded-[14px]">
                  <img src={imageFor(product)} alt={product.brand || categoryLabels[product.category]} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="lazy" />
                </div>
                <div className="px-0.5 pt-3">
                  <p className="truncate text-[12px] font-semibold text-[#382726] sm:text-[13px]">{product.brand || 'Luxe Horizon'}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[.11em] text-[#8b7770]">{categoryLabels[product.category]}</p>
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

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-[#6b2734]"><Loader2 size={22} className="animate-spin" /></div>;
  if (error || !product) return <EmptyState error={error} />;

  const images = product.images?.length ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder) : [{ id: 'fallback', imagePath: heroImage, isPrimary: true, sortOrder: 0 }];
  const whatsappNumber = (import.meta.env.VITE_LUXE_HORIZON_WHATSAPP || '').replace(/\D/g, '');
  const publicUrl = `${window.location.origin}/catalogue/product/${product.id}`;
  const message = `Hi Luxe Horizon, I'm interested in this item 👇\n\n${publicUrl}\n\nIs it available?`;
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : '';

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-5 sm:px-7 sm:pt-8 lg:px-10 lg:pt-10">
      <a href="/catalogue" className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#6b2734]"><ArrowLeft size={14} /> Back</a>
      <div className="grid gap-7 lg:grid-cols-[1.08fr_.92fr] lg:gap-12">
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-[16px] bg-[#e4d8cd] sm:rounded-[20px]">
            <img src={images[activeImage]?.imagePath || heroImage} alt={product.brand || categoryLabels[product.category]} className="h-full w-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button key={image.id} type="button" onClick={() => setActiveImage(index)} className={`h-16 w-14 shrink-0 overflow-hidden rounded-lg border ${activeImage === index ? 'border-[#6b2734]' : 'border-transparent'}`}>
                  <img src={image.imagePath} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-28 lg:self-start lg:pt-5">
          <p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#8a6065]">{categoryLabels[product.category]}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-[#342324] sm:text-5xl">{product.brand || 'Luxe Horizon'}</h1>
          <div className="mt-7 h-px bg-[#daccc0]" />
          <p className="mt-6 max-w-md text-sm leading-7 text-[#76645f]">For availability and details, enquire directly on WhatsApp.</p>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6b2734] px-6 text-[12px] font-semibold text-[#fffaf3] transition hover:bg-[#57202b] sm:w-auto sm:min-w-[220px]">
              <MessageCircle size={16} /> Enquire on WhatsApp
            </a>
          ) : (
            <p className="mt-7 rounded-xl border border-[#daccc0] bg-[#f8f3ed] p-4 text-xs text-[#806d68]">WhatsApp enquiries are being configured.</p>
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
    <div className="min-h-[100dvh] bg-[#f5f0e9] text-[#241b18]">
      <BrandHeader />
      {productMatch ? <ProductDetail productId={decodeURIComponent(productMatch[1])} /> : <CatalogueList />}
      <footer className="border-t border-[#d7cabd] px-4 py-7 text-center sm:px-7">
        <img src={logo} alt="Luxe Horizon" className="mx-auto h-8 w-auto opacity-85" />
      </footer>
    </div>
  );
}
