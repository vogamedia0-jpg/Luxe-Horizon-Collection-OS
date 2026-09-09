import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, BarChart3, Bell,
  Check, CheckCircle2, ChevronDown, ChevronRight, CloudUpload, Copy,
  ExternalLink, Eye, Filter, FolderOpen, Globe2, Heart,
  Image as ImageIcon, LayoutDashboard, ListFilter, Loader2, LockKeyhole,
  Menu, MessageCircle, MoreHorizontal, Package, Pencil, Plus, Save,
  Search, Send, Settings2, ShieldCheck, Sparkles, Trash2, UploadCloud, X, Zap
} from 'lucide-react';
import {
  useHealthCheck,
  useListCollections,
  useCreateCollection,
  useGetCollection,
  useUpdateCollection,
  useDeleteCollection,
  useGetDashboard,
  useListProducts,
  useCreateProduct,
  useGetProduct,
  useUpdateProduct,
  useDeleteProduct,
  useBulkUpdateProducts,
  useUploadProducts,
  useGetCatalogue,
  useGetPublicProduct,
  useGenerateCataloguePdf,
  useGetSettings,
  useUpdateSettings,
  getGetCollectionQueryKey,
  getGetProductQueryKey,
  getGetPublicProductQueryKey,
  getGetDashboardQueryKey,
  getListCollectionsQueryKey,
  getListProductsQueryKey,
  getGetCatalogueQueryKey,
  getGetSettingsQueryKey,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { generateBrandedCataloguePdf } from '@/lib/pdf';

const queryClient = new QueryClient();
const logo = '/assets/logo.png';
const heroImage = '/assets/hero.png';
const boardImage = '/assets/brand-board.png';
const assetImageMap: Record<string, string> = {
  'Luxe_Horizon_in_Marble_Elegance_1788985336468.png': heroImage,
  'Luxe_Horizon_Luxury_Brand_Mockup_1788985388415.png': boardImage,
  'luxe-horizon-logo_1788985353048.png': logo,
};

type Product = {
  id: string; collectionId: string; gender: 'men' | 'women' | 'unknown';
  category: 'clothing' | 'footwear' | 'watches' | 'bags' | 'accessories' | 'other';
  brand?: string | null; aiGender?: string | null; aiCategory?: string | null;
  aiBrand?: string | null; aiConfidence?: number | null; reviewed: boolean;
  isActive: boolean; isPublished: boolean; sortOrder: number; images: { id: string; imagePath: string; isPrimary: boolean; sortOrder: number }[];
};
type Collection = { id: string; name: string; slug: string; startDate?: string | null; endDate?: string | null; isPublished: boolean; publishedAt?: string | null; createdAt: string; updatedAt: string };

const fallbackCollection: Collection = {
  id: 'collection-week-36', name: 'Autumn / Winter 2026', slug: 'new-collection-07-september-2026',
  startDate: '2026-08-15', endDate: '2026-12-20', isPublished: true,
  publishedAt: '2026-08-14T10:00:00Z', createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-14T10:00:00Z',
};
const fallbackProducts: Product[] = [
  { id: 'look-01', collectionId: fallbackCollection.id, gender: 'women', category: 'bags', brand: 'Bottega Veneta', aiGender: 'women', aiCategory: 'bags', aiBrand: 'Bottega Veneta', aiConfidence: .98, reviewed: true, isActive: true, isPublished: true, sortOrder: 1, images: [{ id: 'img-01', imagePath: heroImage, isPrimary: true, sortOrder: 1 }] },
  { id: 'look-02', collectionId: fallbackCollection.id, gender: 'women', category: 'clothing', brand: 'The Row', aiGender: 'women', aiCategory: 'clothing', aiBrand: 'The Row', aiConfidence: .95, reviewed: true, isActive: true, isPublished: true, sortOrder: 2, images: [{ id: 'img-02', imagePath: boardImage, isPrimary: true, sortOrder: 1 }] },
  { id: 'look-03', collectionId: fallbackCollection.id, gender: 'men', category: 'watches', brand: 'Cartier', aiGender: 'men', aiCategory: 'watches', aiBrand: 'Cartier', aiConfidence: .92, reviewed: true, isActive: true, isPublished: true, sortOrder: 3, images: [{ id: 'img-03', imagePath: heroImage, isPrimary: true, sortOrder: 1 }] },
  { id: 'look-04', collectionId: fallbackCollection.id, gender: 'women', category: 'footwear', brand: 'Manolo Blahnik', aiGender: 'women', aiCategory: 'footwear', aiBrand: 'Manolo Blahnik', aiConfidence: .88, reviewed: false, isActive: true, isPublished: false, sortOrder: 4, images: [{ id: 'img-04', imagePath: boardImage, isPrimary: true, sortOrder: 1 }] },
  { id: 'look-05', collectionId: fallbackCollection.id, gender: 'unknown', category: 'accessories', brand: null, aiGender: 'unknown', aiCategory: 'accessories', aiBrand: null, aiConfidence: .61, reviewed: false, isActive: true, isPublished: false, sortOrder: 5, images: [{ id: 'img-05', imagePath: heroImage, isPrimary: true, sortOrder: 1 }] },
  { id: 'look-06', collectionId: fallbackCollection.id, gender: 'men', category: 'clothing', brand: 'Loro Piana', aiGender: 'men', aiCategory: 'clothing', aiBrand: 'Loro Piana', aiConfidence: .97, reviewed: true, isActive: true, isPublished: true, sortOrder: 6, images: [{ id: 'img-06', imagePath: boardImage, isPrimary: true, sortOrder: 1 }] },
];

const navGroups = [
  { label: 'Workspace', items: [
    { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/upload', label: 'Upload batch', icon: CloudUpload },
    { href: '/admin/review', label: 'Review queue', icon: Eye },
  ] },
  { label: 'Catalogue', items: [
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/collections', label: 'Collections', icon: FolderOpen },
    { href: '/admin/catalogue', label: 'Publish & links', icon: Globe2 },
  ] },
];
const categoryLabels: Record<string, string> = { clothing: 'Clothing', footwear: 'Footwear', watches: 'Watches', bags: 'Bags', accessories: 'Accessories', other: 'Other' };
const genderLabels: Record<string, string> = { men: 'Men', women: 'Women', unknown: 'Unsorted' };
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not set';
const resolveImage = (path?: string | null) => !path ? heroImage : path.startsWith('/') ? path : assetImageMap[path] || heroImage;
const imageFor = (product: Product) => resolveImage(product.images?.find((image) => image.isPrimary)?.imagePath || product.images?.[0]?.imagePath);

function AppLogo({ dark = false }: { dark?: boolean }) {
  return <img src={logo} alt="Luxe horizon" className={`h-10 w-auto object-contain ${dark ? 'brightness-0 invert opacity-90' : ''}`} />;
}

function IconButton({ label, children, onClick, className = '' }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={onClick} className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] ${className}`}>{children}</button>;
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setPending(true);
    setError('');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError('That email or password was not accepted.');
    setPending(false);
  };

  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-5 py-10 text-[hsl(var(--sidebar-foreground))] noise">
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.06] p-7 shadow-2xl sm:p-10">
      <AppLogo dark />
      <p className="mt-10 font-mono-ui text-[10px] uppercase tracking-[.22em] text-[#d9bb8c]">Private operations</p>
      <h1 className="mt-3 font-display text-4xl">Welcome back.</h1>
      <p className="mt-3 text-sm leading-6 text-white/60">Sign in to manage the Luxe Horizon collection.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-xs font-semibold">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm text-white outline-none focus:border-[#d9bb8c]" autoComplete="email" /></label>
        <label className="block text-xs font-semibold">Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm text-white outline-none focus:border-[#d9bb8c]" autoComplete="current-password" /></label>
        {error && <p role="alert" className="text-xs text-[#f0b4a2]">{error}</p>}
        <button type="submit" disabled={pending} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#d9bb8c] px-5 text-xs font-semibold text-[#3b2021] disabled:opacity-50">{pending ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />} Enter private space</button>
      </form>
    </div>
  </div>;
}

function AuthenticatedAdmin({ children }: { children: React.ReactNode }) {
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setHasSession(Boolean(nextSession));
      setSessionReady(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) return <>{children}</>;
  if (!sessionReady) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] text-[#d9bb8c]"><Loader2 className="animate-spin" size={22} /></div>;
  return hasSession ? <>{children}</> : <AdminLogin />;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'dark' | 'gold' | 'warning' | 'success' }) {
  const styles = { neutral: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]', dark: 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]', gold: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]', warning: 'bg-[#efe0c0] text-[#785a25]', success: 'bg-[#dbe9df] text-[#31583f]' };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.13em] ${styles[tone]}`}>{children}</span>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: health } = useHealthCheck({ query: { queryKey: ['/api/healthz'] as const, staleTime: 30000 } });
  return <AuthenticatedAdmin><div className="min-h-[100dvh] bg-[hsl(var(--background))] noise">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] -translate-x-full flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : ''}`}>
      <div className="mb-10 flex items-center justify-between px-2"><AppLogo dark /><button onClick={() => setOpen(false)} className="rounded-full p-2 text-white/70 lg:hidden" aria-label="Close navigation"><X size={18} /></button></div>
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[.05] p-3">
        <p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#d9bb8c]">Active collection</p>
        <p className="mt-2 font-display text-[17px]">Autumn / Winter 2026</p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60"><span className="h-1.5 w-1.5 rounded-full bg-[#c8a46a]" /> Last synced 4 min ago</div>
      </div>
      <nav className="flex-1 space-y-7">
        {navGroups.map((group) => <div key={group.label}><p className="mb-2 px-3 font-mono-ui text-[9px] uppercase tracking-[.2em] text-white/40">{group.label}</p><div className="space-y-1">{group.items.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition ${location === href ? 'bg-white/[.12] text-[#e1c18d]' : 'text-white/70 hover:bg-white/[.07] hover:text-white'}`}><NavIcon size={17} strokeWidth={1.6} /><span>{label}</span>{label === 'Review queue' && <span className="ml-auto rounded-full bg-[#cfa878] px-1.5 py-0.5 text-[9px] font-bold text-[#3b2021]">12</span>}</Link>)}</div></div>)}
      </nav>
      <div className="border-t border-white/10 pt-5"><Link href="/admin/settings" className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] ${location === '/admin/settings' ? 'bg-white/[.12] text-[#e1c18d]' : 'text-white/70 hover:text-white'}`}><Settings2 size={17} strokeWidth={1.6} /> Settings</Link><div className="mt-5 flex items-center justify-between px-3 text-[10px] text-white/40"><span className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${health ? 'bg-emerald-400' : 'bg-[#cfa878]'}`} /> {health ? 'System online' : 'Demo mode'}</span><span>v1.0.4</span></div></div>
    </aside>
    <div className="lg:pl-[272px]">
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-5 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-full p-2 lg:hidden" aria-label="Open navigation"><Menu size={21} /></button><div className="lg:hidden"><AppLogo /></div><div className="hidden items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] lg:flex"><ShieldCheck size={15} className="text-[hsl(var(--primary))]" /> Private operations space</div></div>
        <div className="flex items-center gap-2"><IconButton label="Notifications"><Bell size={17} /></IconButton><div className="ml-2 flex items-center gap-2 border-l border-[hsl(var(--border))] pl-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-display text-sm text-[hsl(var(--primary-foreground))]">LH</span><span className="hidden text-xs font-semibold sm:block">House owner</span><ChevronDown size={14} className="hidden text-[hsl(var(--muted-foreground))] sm:block" /></div></div>
      </header>
      <main>{children}</main>
    </div>
  </div></AuthenticatedAdmin>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-2 font-display text-4xl tracking-[-.03em] text-[hsl(var(--foreground))] sm:text-5xl">{title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p></div>{action}</div>;
}

function StatCard({ label, value, detail, accent = false }: { label: string; value: string | number; detail: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-5 ${accent ? 'border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--card-border))] bg-[hsl(var(--card))]'}`}><p className={`font-mono-ui text-[9px] uppercase tracking-[.15em] ${accent ? 'text-white/60' : 'text-[hsl(var(--muted-foreground))]'}`}>{label}</p><p className="mt-3 font-display text-4xl">{value}</p><p className={`mt-2 text-xs ${accent ? 'text-white/60' : 'text-[hsl(var(--muted-foreground))]'}`}>{detail}</p></div>;
}

function DashboardPage() {
  const { data: summary, isLoading } = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), retry: false } });
  const current = summary?.collection ?? fallbackCollection;
  const { data: collectionDetail } = useGetCollection(current.id, { query: { enabled: !!current.id, queryKey: getGetCollectionQueryKey(current.id), retry: false } });
  const total = summary?.totalUploaded ?? 48;
  const needsReview = summary?.needsReview ?? 12;
  const published = summary?.published ?? 36;
  const categories = summary?.categories ?? { clothing: 19, bags: 11, footwear: 8, watches: 6, accessories: 4 };
  return <AdminShell><div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
    <PageIntro eyebrow="Operations / 01" title="Good morning, house." description="A quiet view of what needs your eye today." action={<Link href="/admin/upload" data-testid="link-upload-new-batch" className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 hover:shadow-lg"><Plus size={16} /> Upload new batch</Link>} />
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{isLoading ? [1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />) : <><StatCard label="Uploaded this season" value={total} detail="+8 since yesterday" accent /><StatCard label="Needs your eye" value={needsReview} detail="Across 5 categories" /><StatCard label="Published to catalogue" value={published} detail={`${Math.round((published / Math.max(total, 1)) * 100)}% of collection`} /><StatCard label="Unsorted" value={summary?.unknown ?? 3} detail="AI confidence below 70%" /></>}</div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
       <section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-editorial sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Badge tone="gold"><Sparkles size={11} /> Current season</Badge><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">Updated 4 min ago</span></div><h2 className="mt-4 font-display text-3xl">{collectionDetail?.name || current.name}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(current.startDate)} — {formatDate(current.endDate)}</p></div><Link href="/admin/collections" className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]">Manage collection <ArrowUpRight size={14} /></Link></div><div className="mt-9 grid gap-7 sm:grid-cols-2"><div><div className="mb-2 flex items-end justify-between text-xs"><span className="text-[hsl(var(--muted-foreground))]">Review progress</span><strong>{total - needsReview} / {total}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${((total - needsReview) / Math.max(total, 1)) * 100}%` }} /></div></div><div><div className="mb-2 flex items-end justify-between text-xs"><span className="text-[hsl(var(--muted-foreground))]">Catalogue ready</span><strong>{published} / {total}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[#c7a269]" style={{ width: `${(published / Math.max(total, 1)) * 100}%` }} /></div></div></div><div className="mt-10 grid grid-cols-3 gap-3 border-t border-[hsl(var(--border))] pt-5"><div><p className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">MEN</p><p className="mt-1 text-2xl font-semibold">{summary?.men ?? 21}</p></div><div><p className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">WOMEN</p><p className="mt-1 text-2xl font-semibold">{summary?.women ?? 24}</p></div><div><p className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">UNKNOWN</p><p className="mt-1 text-2xl font-semibold text-[hsl(var(--primary))]">{summary?.unknown ?? 3}</p></div></div></section>
      <section className="rounded-2xl bg-[#e8dfd3] p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#74564a]">Quick actions</p><h2 className="mt-2 font-display text-2xl text-[#3d2926]">Keep the rhythm.</h2></div><Zap size={22} className="text-[#8a5a43]" /></div><div className="mt-7 space-y-2"><Link href="/admin/review" className="group flex items-center justify-between rounded-xl bg-[#f7f1e9] p-4 transition hover:-translate-y-0.5"><span className="flex items-center gap-3 text-sm font-semibold text-[#3d2926]"><Eye size={17} className="text-[#8a5a43]" /> Review unsure items <span className="rounded-full bg-[#d7b36e] px-2 py-0.5 text-[10px]">12</span></span><ChevronRight size={16} className="transition group-hover:translate-x-1" /></Link><Link href="/admin/catalogue" className="group flex items-center justify-between rounded-xl bg-[#f7f1e9] p-4 transition hover:-translate-y-0.5"><span className="flex items-center gap-3 text-sm font-semibold text-[#3d2926]"><Send size={17} className="text-[#8a5a43]" /> Share catalogue link</span><ChevronRight size={16} className="transition group-hover:translate-x-1" /></Link><Link href="/admin/collections" className="group flex items-center justify-between rounded-xl bg-[#f7f1e9] p-4 transition hover:-translate-y-0.5"><span className="flex items-center gap-3 text-sm font-semibold text-[#3d2926]"><FolderOpen size={17} className="text-[#8a5a43]" /> View collection history</span><ChevronRight size={16} className="transition group-hover:translate-x-1" /></Link></div></section>
    </div>
    <section className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Category mix</p><h2 className="mt-2 font-display text-2xl">This collection, by edit.</h2></div><BarChart3 size={19} className="text-[hsl(var(--primary))]" /></div><div className="mt-7 space-y-4">{Object.entries(categories).map(([name, count]) => <div key={name} className="flex items-center gap-3 text-sm"><span className="w-20 text-[hsl(var(--muted-foreground))]">{categoryLabels[name] ?? name}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[#9e6a69]" style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} /></div><span className="w-6 text-right font-mono-ui text-xs">{count}</span></div>)}</div></div><div className="relative min-h-[260px] overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))]"><img src={heroImage} alt="Luxe horizon editorial campaign" className="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-screen" /><div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--sidebar))] via-[hsl(var(--sidebar))]/50 to-transparent" /><div className="relative flex h-full max-w-sm flex-col justify-end p-7 text-white sm:p-9"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#d3b47d]">House note</p><p className="mt-3 font-display text-3xl leading-tight">“The catalogue should feel like a well-kept room.”</p><p className="mt-4 text-xs text-white/60">A point of view from the Luxe Horizon team.</p></div></div></section>
  </div></AdminShell>;
}

function UploadPage() {
  const { data: collections } = useListCollections({ query: { queryKey: getListCollectionsQueryKey(), retry: false } });
  const createProduct = useCreateProduct();
  const uploadProducts = useUploadProducts();
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState<'mixed' | 'men' | 'women'>('mixed');
  const [collectionId, setCollectionId] = useState(fallbackCollection.id);
  const [message, setMessage] = useState('');
  const activeCollections = collections?.length ? collections : [fallbackCollection];
  const addFiles = (incoming: FileList | null) => incoming && setFiles((current) => [...current, ...Array.from(incoming)]);
  const submit = () => {
    if (!files.length) { setMessage('Choose at least one image to start a batch.'); return; }
    uploadProducts.mutate({ data: { collectionId, batchHint: hint, images: files.map((file) => ({ imagePath: file.name, imageUrl: URL.createObjectURL(file) })) } }, { onSuccess: () => setMessage('Batch uploaded. AI sorting is now running.'), onError: () => { createProduct.mutate({ data: { collectionId, gender: hint === 'mixed' ? 'unknown' : hint, category: 'other', imagePath: files[0].name, imageUrl: URL.createObjectURL(files[0]) } }); setMessage('Demo batch staged locally. Connect the API to persist these images.'); } });
  };
  return <AdminShell><div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><PageIntro eyebrow="Workspace / 02" title="Bring in the edit." description="Upload a clean batch, give the sorter a direction, then let it prepare the first pass." action={<Badge tone="success"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Storage ready</Badge>} />
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 sm:p-8"><div className="mb-6 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Batch setup</p><h2 className="mt-2 font-display text-2xl">Start with context.</h2></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">01 / 02</span></div><label className="mb-5 block text-xs font-semibold">Collection<select value={collectionId} onChange={(event) => setCollectionId(event.target.value)} data-testid="select-upload-collection" className="mt-2 h-12 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]">{activeCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label><div><p className="text-xs font-semibold">Batch hint</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">A useful nudge for AI, not a hard rule.</p><div className="mt-3 grid grid-cols-3 gap-2">{(['mixed', 'men', 'women'] as const).map((option) => <button type="button" key={option} onClick={() => setHint(option)} data-testid={`button-batch-hint-${option}`} className={`rounded-lg border px-3 py-3 text-xs font-semibold capitalize transition ${hint === option ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.07] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50'}`}>{option}</button>)}</div></div><label className="mt-7 flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#bfae9a] bg-[#f4eee5] px-6 text-center transition hover:border-[hsl(var(--primary))]"><UploadCloud size={29} className="text-[hsl(var(--primary))]" /><span className="mt-4 font-display text-2xl text-[#3d2926]">Drop the campaign images here</span><span className="mt-2 text-xs text-[#806b61]">JPG, PNG or WEBP · Up to 50MB each</span><span className="mt-5 rounded-full border border-[#ad9787] px-4 py-2 text-xs font-semibold text-[#5d463e]">Browse files</span><input type="file" accept="image/*" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} data-testid="input-upload-images" /></label>{files.length > 0 && <div className="mt-5 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs"><ImageIcon size={15} className="text-[hsl(var(--primary))]" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X size={14} /></button></div>)}</div>}<div className="mt-7 flex flex-col-reverse gap-3 border-t border-[hsl(var(--border))] pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[hsl(var(--muted-foreground))]">{message || (files.length ? `${files.length} image${files.length === 1 ? '' : 's'} ready for sorting.` : 'Nothing staged yet.')}</p><button type="button" disabled={uploadProducts.isPending} onClick={submit} data-testid="button-upload-and-sort" className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{uploadProducts.isPending ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />} Upload & sort</button></div></section>
      <aside className="space-y-5"><div className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d6b782]"><Sparkles size={17} /><span className="font-mono-ui text-[10px] uppercase tracking-[.18em]">AI sorting</span></div><h2 className="mt-5 font-display text-3xl leading-tight">A first pass, not a final word.</h2><p className="mt-3 text-sm leading-6 text-white/65">Luxe Horizon reads each image for gender, category and brand. Low-confidence items stay in your review queue, never hidden.</p><div className="mt-7 space-y-3 border-t border-white/10 pt-5"><div className="flex items-center gap-3 text-xs"><CheckCircle2 size={15} className="text-[#d6b782]" /> Recognises visual categories</div><div className="flex items-center gap-3 text-xs"><CheckCircle2 size={15} className="text-[#d6b782]" /> Flags unsure classifications</div><div className="flex items-center gap-3 text-xs"><CheckCircle2 size={15} className="text-[#d6b782]" /> Keeps originals untouched</div></div></div><div className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Before you upload</p><ul className="mt-4 space-y-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--primary))]" />Keep one product per frame where possible.</li><li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--primary))]" />Use a batch hint when the edit is directional.</li><li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--primary))]" />You can always correct the sort in review.</li></ul></div></aside></div>
  </div></AdminShell>;
}

function ReviewPage() {
  const { data } = useListProducts({ reviewed: false }, { query: { queryKey: getListProductsQueryKey({ reviewed: false }), retry: false } });
  const updateProduct = useUpdateProduct();
  const bulkUpdate = useBulkUpdateProducts();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'unknown'>('all');
  const products = (data?.length ? data : fallbackProducts.filter((product) => !product.reviewed)).filter((product) => filter === 'all' || product.gender === 'unknown');
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const review = (product: Product, reviewed = true) => updateProduct.mutate({ productId: product.id, data: { reviewed, gender: product.gender, category: product.category, brand: product.brand || null } });
  return <AdminShell><div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><PageIntro eyebrow="Workspace / 03" title="Trust, then tune." description="The unsure queue is deliberately small. Confirm what feels right and keep the house language consistent." action={<Link href="/admin/products" className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-3 text-xs font-semibold"><ListFilter size={15} /> All products</Link>} /><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 rounded-full bg-[hsl(var(--muted))] p-1">{(['all', 'unknown'] as const).map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${filter === item ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-review-filter-${item}`}>{item === 'all' ? `All unsure (${products.length})` : 'Unknown only'}</button>)}</div>{selected.length > 0 && <div className="flex items-center gap-2"><span className="text-xs text-[hsl(var(--muted-foreground))]">{selected.length} selected</span><button type="button" onClick={() => bulkUpdate.mutate({ data: { productIds: selected, reviewed: true } })} className="rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-bulk-approve">Approve selected</button></div>}</div>{products.length === 0 ? <EmptyState icon={<CheckCircle2 />} title="The queue is clear." description="Every item has been reviewed for this collection." action={<Link href="/admin/products" className="rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-white">Browse products</Link>} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product, index) => <article key={product.id} className="animate-rise overflow-hidden rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] shadow-editorial" style={{ animationDelay: `${index * 55}ms` }}><div className="relative aspect-[1.15] overflow-hidden bg-[#ded2c5]"><img src={imageFor(product)} alt={`${product.brand || 'Unsorted'} ${categoryLabels[product.category]}`} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" /><button type="button" onClick={() => toggle(product.id)} aria-label={`Select product ${product.id}`} className={`absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border ${selected.includes(product.id) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-white/70 bg-black/20 text-white'}`} data-testid={`button-select-product-${product.id}`}>{selected.includes(product.id) && <Check size={14} />}</button><Badge tone={product.gender === 'unknown' ? 'warning' : 'gold'}>{Math.round((product.aiConfidence || .5) * 100)}% confidence</Badge><div className="absolute right-3 top-3"><Badge tone={product.gender === 'unknown' ? 'warning' : 'dark'}>{genderLabels[product.gender]}</Badge></div></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{product.id}</p><h2 className="mt-1 font-display text-2xl">{product.brand || 'Brand to confirm'}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{categoryLabels[product.category]} · AI suggested {product.aiCategory || 'other'}</p></div><IconButton label={`Edit ${product.id}`}><Pencil size={15} /></IconButton></div><div className="mt-5 flex gap-2"><button type="button" onClick={() => review(product, true)} className="flex-1 rounded-full bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-semibold text-white" data-testid={`button-approve-${product.id}`}>Approve</button><button type="button" onClick={() => review(product, false)} className="rounded-full border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-semibold" data-testid={`button-keep-unsure-${product.id}`}>Keep unsure</button></div></div></article>)}</div>}</div></AdminShell>;
}

function ProductCard({ product, onDelete }: { product: Product; onDelete?: (id: string) => void }) {
  return <article className="group overflow-hidden rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))]"><Link href={`/catalogue/product/${product.id}`} className="relative block aspect-[.85] overflow-hidden bg-[#ded2c5]"><img src={imageFor(product)} alt={`${product.brand || 'Luxe Horizon'} ${categoryLabels[product.category]}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /><div className="absolute left-3 top-3"><Badge tone={product.isPublished ? 'success' : 'neutral'}>{product.isPublished ? 'Live' : 'Draft'}</Badge></div><button type="button" onClick={(event) => { event.preventDefault(); onDelete?.(product.id); }} aria-label={`Delete product ${product.id}`} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white opacity-0 transition group-hover:opacity-100" data-testid={`button-delete-product-${product.id}`}><Trash2 size={14} /></button></Link><div className="p-4"><div className="flex items-center justify-between gap-2"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{genderLabels[product.gender]} / {categoryLabels[product.category]}</p><h3 className="mt-1 font-display text-xl">{product.brand || 'House edit'}</h3></div><button type="button" aria-label={`Edit product ${product.id}`} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid={`button-edit-product-${product.id}`}><MoreHorizontal size={16} /></button></div></div></article>;
}

function ProductsPage() {
  const { data } = useListProducts(undefined, { query: { queryKey: getListProductsQueryKey(), retry: false } });
  const deleteProduct = useDeleteProduct();
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('all');
  const products = (data?.length ? data : fallbackProducts).filter((product) => `${product.brand || ''} ${product.category}`.toLowerCase().includes(search.toLowerCase()) && (gender === 'all' || product.gender === gender));
  return <AdminShell><div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><PageIntro eyebrow="Catalogue / 01" title="The product room." description="Everything in the active collection, from first upload to public-facing finish." action={<Link href="/admin/upload" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-white"><Plus size={15} /> Add products</Link>} /><div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><label className="relative block max-w-md flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brand or category" data-testid="input-search-products" className="h-11 w-full rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-4 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label><div className="flex items-center gap-2"><Filter size={15} className="text-[hsl(var(--muted-foreground))]" />{['all', 'women', 'men', 'unknown'].map((item) => <button type="button" key={item} onClick={() => setGender(item)} className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${gender === item ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))]'}`} data-testid={`button-filter-${item}`}>{item === 'all' ? 'All' : genderLabels[item]}</button>)}</div></div>{products.length === 0 ? <EmptyState icon={<Package />} title="No products match this edit." description="Try another brand, category or gender filter." /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} onDelete={(id) => { if (window.confirm('Remove this product from the collection?')) deleteProduct.mutate({ productId: id }); }} />)}</div>}</div></AdminShell>;
}

function CollectionsPage() {
  const { data } = useListCollections({ query: { queryKey: getListCollectionsQueryKey(), retry: false } });
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const collections = data?.length ? data : [fallbackCollection, { ...fallbackCollection, id: 'ss26', slug: 'spring-summer-2026', name: 'Spring / Summer 2026', isPublished: false, publishedAt: null, startDate: '2026-01-10', endDate: '2026-07-30' }];
  const submit = () => { const clean = name.trim(); if (!clean) return; createCollection.mutate({ data: { name: clean, slug: clean.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'), startDate: null, endDate: null } }, { onSuccess: () => { setName(''); setShowCreate(false); } }); };
  return <AdminShell><div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><PageIntro eyebrow="Catalogue / 02" title="Collection history." description="Seasons have a lifespan. Keep the archive orderly, and only let one edit lead the room." action={<button type="button" onClick={() => setShowCreate((current) => !current)} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-white" data-testid="button-new-collection"><Plus size={15} /> New collection</button>} />{showCreate && <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--card))] p-4 sm:flex-row"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Resort 2027" data-testid="input-new-collection-name" className="h-11 flex-1 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm outline-none" /><button type="button" onClick={submit} className="rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-xs font-semibold text-white" data-testid="button-save-collection">Create collection</button></div>}<div className="space-y-3">{collections.map((collection, index) => <div key={collection.id} className={`group flex flex-col gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${index === 0 ? 'border-[hsl(var(--primary))]/25 bg-[hsl(var(--card))] shadow-editorial' : 'border-[hsl(var(--card-border))] bg-[hsl(var(--card))]'}`}><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${index === 0 ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}><FolderOpen size={20} /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl">{collection.name}</h2>{collection.isPublished ? <Badge tone="success">Published</Badge> : <Badge>Archive</Badge>}</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(collection.startDate)} — {formatDate(collection.endDate)} <span className="mx-1">·</span> /{collection.slug}</p></div></div><div className="flex items-center gap-2 sm:justify-end"><span className="mr-2 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{index === 0 ? '48 products' : 'Closed'}</span>{!collection.isPublished && <button type="button" onClick={() => updateCollection.mutate({ collectionId: collection.id, data: { isPublished: true } })} className="rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-white" data-testid={`button-publish-collection-${collection.id}`}>Publish</button>}<IconButton label={`More actions for ${collection.name}`} onClick={() => { if (window.confirm('Delete this collection?')) deleteCollection.mutate({ collectionId: collection.id }); }}><MoreHorizontal size={16} /></IconButton></div></div>)}</div></div></AdminShell>;
}

function CatalogueAdminPage() {
  const { data: catalogue } = useGetCatalogue(undefined, { query: { queryKey: getGetCatalogueQueryKey(), retry: false } });
  const generatePdf = useGenerateCataloguePdf();
  const products = catalogue?.products?.length ? catalogue.products : fallbackProducts;
  const [gender, setGender] = useState('all');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const filtered = products.filter((product) => (gender === 'all' || product.gender === gender) && (category === 'all' || product.category === category) && (brand === 'all' || product.brand === brand));
  const brands = [...new Set(products.flatMap((product) => product.brand ? [product.brand] : []))].sort();
  const copyLink = () => {
    const query = new URLSearchParams();
    if (gender !== 'all') query.set('gender', gender);
    if (category !== 'all') query.set('category', category);
    if (brand !== 'all') query.set('brand', brand);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    navigator.clipboard?.writeText(`${window.location.origin}/catalogue${suffix}`);
  };
  const downloadPdf = async () => {
    const title = `${catalogue?.collection?.name || fallbackCollection.name} — Private Edit`;
    try {
      await generatePdf.mutateAsync({ data: { title, productIds: filtered.filter((product) => product.isPublished).map((product) => product.id) } });
    } catch {
      // Local export remains available while the server-side PDF worker is configured.
    }
    await generateBrandedCataloguePdf(title, filtered.filter((product) => product.isPublished), resolveImage);
  };
  return <AdminShell>
    <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <PageIntro eyebrow="Catalogue / 03" title="Publish with composure." description="Decide what is ready for the outside world, then share one considered link." action={<button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-3 text-xs font-semibold" data-testid="button-copy-catalogue-link"><Copy size={15} /> Copy public link</button>} />
      <section className="mb-5 overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))] text-white">
        <div className="grid md:grid-cols-[1fr_.8fr]">
          <div className="p-7 sm:p-10">
            <Badge tone="gold"><Globe2 size={11} /> Customer-facing</Badge>
            <h2 className="mt-5 max-w-lg font-display text-4xl leading-tight">A catalogue that gives the edit room to breathe.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/60">Your public link is live with {filtered.filter((product) => product.isPublished).length} published products from {catalogue?.collection?.name || fallbackCollection.name}.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/catalogue" className="inline-flex items-center gap-2 rounded-full bg-[#d8b87f] px-5 py-3 text-xs font-semibold text-[#392326]">View public catalogue <ExternalLink size={14} /></Link>
              <button type="button" onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-xs font-semibold text-white" data-testid="button-generate-pdf"><ArrowDownToLine size={14} /> {generatePdf.isPending ? 'Preparing PDF' : 'Generate private PDF'}</button>
            </div>
          </div>
          <div className="relative min-h-[260px]"><img src={boardImage} alt="Luxe Horizon brand materials" className="absolute inset-0 h-full w-full object-cover opacity-65" /><div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--sidebar))] via-transparent to-transparent" /></div>
        </div>
      </section>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-2 text-xs font-semibold">Link view</span>
        {['all', 'women', 'men', 'unknown'].map((item) => <button type="button" key={item} onClick={() => setGender(item)} className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${gender === item ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))]'}`} data-testid={`button-catalogue-filter-${item}`}>{item === 'all' ? 'All products' : genderLabels[item]}</button>)}
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-full border border-[hsl(var(--border))] bg-transparent px-3 text-xs" data-testid="select-admin-catalogue-category"><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-9 max-w-[150px] rounded-full border border-[hsl(var(--border))] bg-transparent px-3 text-xs" data-testid="select-admin-catalogue-brand"><option value="all">All houses</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))]">
        <div className="hidden grid-cols-[1fr_120px_120px_100px] gap-4 border-b border-[hsl(var(--border))] px-5 py-3 font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] sm:grid"><span>Product</span><span>Gender</span><span>State</span><span>Action</span></div>
        {filtered.slice(0, 8).map((product) => <div key={product.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-4 last:border-0 sm:grid-cols-[1fr_120px_120px_100px] sm:gap-4 sm:px-5"><div className="flex items-center gap-3"><img src={imageFor(product)} alt="" className="h-11 w-11 rounded-lg object-cover" /><div><p className="text-sm font-semibold">{product.brand || 'House edit'}</p><p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{product.id}</p></div></div><span className="hidden text-xs capitalize text-[hsl(var(--muted-foreground))] sm:block">{genderLabels[product.gender]}</span><span className="justify-self-end sm:justify-self-start"><Badge tone={product.isPublished ? 'success' : 'neutral'}>{product.isPublished ? 'Live' : 'Draft'}</Badge></span><Link href={`/catalogue/product/${product.id}`} className="hidden text-xs font-semibold text-[hsl(var(--primary))] sm:block">Open</Link></div>)}
      </div>
    </div>
  </AdminShell>;
}

function SettingsPage() {
  const { data } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey(), retry: false } });
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState({ whatsappNumber: data?.whatsappNumber || import.meta.env.VITE_LUXE_HORIZON_WHATSAPP || '', businessName: data?.businessName || 'Luxe Horizon', tagline: data?.tagline || 'The pinnacle of luxury shopping' });
  const save = () => updateSettings.mutate({ data: form });
  return <AdminShell><div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><PageIntro eyebrow="House / Settings" title="Keep it considered." description="A small set of details that quietly shape every catalogue touchpoint." /><div className="grid gap-5 md:grid-cols-[1fr_.7fr]"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><MessageCircle size={18} /></div><div><h2 className="font-display text-2xl">WhatsApp enquiries</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Shown when a customer asks about a piece.</p></div></div><div className="mt-7 space-y-5"><label className="block text-xs font-semibold">WhatsApp number<input value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} data-testid="input-whatsapp-number" className="mt-2 h-12 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label><label className="block text-xs font-semibold">Business name<input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} data-testid="input-business-name" className="mt-2 h-12 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label><label className="block text-xs font-semibold">Catalogue tagline<input value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} data-testid="input-catalogue-tagline" className="mt-2 h-12 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label></div><button type="button" onClick={save} disabled={updateSettings.isPending} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-white disabled:opacity-50" data-testid="button-save-settings">{updateSettings.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save settings</button></section><aside className="rounded-2xl bg-[#e8dfd3] p-6 sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#74564a]">Preview</p><img src={logo} alt="Luxe horizon" className="mt-7 h-12 w-auto object-contain object-left" /><p className="mt-4 max-w-[220px] font-display text-2xl leading-tight text-[#3d2926]">{form.tagline}</p><div className="mt-10 border-t border-[#bca999] pt-4 text-xs text-[#806b61]"><p>{form.businessName}</p><p className="mt-1">{form.whatsappNumber}</p></div></aside></div></div></AdminShell>;
}

function CataloguePage() {
  const [location] = useLocation();
  const { data: catalogue } = useGetCatalogue(undefined, { query: { queryKey: getGetCatalogueQueryKey(), retry: false } });
  const sharedGender = new URLSearchParams(location.split('?')[1] || '').get('gender') || 'all';
  const sharedCategory = new URLSearchParams(location.split('?')[1] || '').get('category') || 'all';
  const sharedBrand = new URLSearchParams(location.split('?')[1] || '').get('brand') || 'all';
  const [gender, setGender] = useState(sharedGender);
  const [category, setCategory] = useState(sharedCategory);
  const [brand, setBrand] = useState(sharedBrand);
  const products = catalogue?.products?.length ? catalogue.products : fallbackProducts.filter((product) => product.isPublished);
  const brands = catalogue?.availableBrands?.length ? catalogue.availableBrands : ['Bottega Veneta', 'The Row', 'Cartier', 'Loro Piana', 'Manolo Blahnik'];
  const visible = products.filter((product) => (gender === 'all' || product.gender === gender) && (category === 'all' || product.category === category) && (brand === 'all' || product.brand === brand));
  return <div className="min-h-[100dvh] bg-[#f3eee6] text-[#241b18] noise"><header className="sticky top-0 z-30 border-b border-[#d5c7b9] bg-[#f3eee6]/95 backdrop-blur-md"><div className="mx-auto flex h-[76px] max-w-[1380px] items-center justify-between px-5 sm:px-8"><Link href="/catalogue" data-testid="link-catalogue-home"><AppLogo /></Link><div className="hidden items-center gap-7 text-[11px] uppercase tracking-[.16em] md:flex"><a href="#collection" className="hover:text-[#6b2734]">The collection</a><a href="#about" className="hover:text-[#6b2734]">The house</a><Link href="/admin/dashboard" className="flex items-center gap-2 text-[#6b2734]"><LockKeyhole size={13} /> Private access</Link></div><IconButton label="Catalogue menu" className="md:hidden"><Menu size={18} /></IconButton></div></header><main><section className="relative mx-auto grid max-w-[1380px] overflow-hidden px-5 pb-10 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-[.78fr_1.22fr] lg:gap-12 lg:pb-16 lg:pt-16"><div className="relative z-10 flex flex-col justify-center pb-9 lg:pb-0"><p className="font-mono-ui text-[10px] uppercase tracking-[.23em] text-[#7d4c4d]">Luxe Horizon / {catalogue?.collection?.name || 'Autumn / Winter 2026'}</p><h1 className="mt-5 max-w-xl font-display text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl">A private view of <em className="text-[#6b2734]">what’s next.</em></h1><p className="mt-6 max-w-md text-sm leading-7 text-[#806b61]">A considered edit of exceptional pieces, selected for the way they live together.</p><a href="#collection" className="mt-8 inline-flex w-fit items-center gap-2 border-b border-[#6b2734] pb-2 text-xs font-semibold uppercase tracking-[.12em] text-[#6b2734]">Enter the collection <ArrowDownToLine size={14} /></a></div><div className="relative min-h-[440px] overflow-hidden rounded-sm sm:min-h-[600px]"><img src={heroImage} alt="Luxe Horizon campaign" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" /><div className="absolute bottom-5 left-5 flex items-center gap-3 text-[10px] uppercase tracking-[.15em] text-white/80"><span className="h-px w-8 bg-white/70" /> London / 2026</div></div></section><section id="collection" className="mx-auto max-w-[1380px] px-5 pb-20 sm:px-8"><div className="flex flex-col justify-between gap-5 border-t border-[#d5c7b9] py-7 sm:flex-row sm:items-center"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#7d4c4d]">The edit</p><h2 className="mt-2 font-display text-3xl sm:text-4xl">Objects with a point of view.</h2></div><div className="flex flex-wrap gap-2"><select value={gender} onChange={(event) => setGender(event.target.value)} className="h-10 rounded-full border border-[#cdbdb0] bg-transparent px-3 text-xs outline-none" data-testid="select-catalogue-gender"><option value="all">Everyone</option><option value="women">Women</option><option value="men">Men</option></select><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-full border border-[#cdbdb0] bg-transparent px-3 text-xs outline-none" data-testid="select-catalogue-category"><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-10 max-w-[150px] rounded-full border border-[#cdbdb0] bg-transparent px-3 text-xs outline-none" data-testid="select-catalogue-brand"><option value="all">All houses</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>{visible.length === 0 ? <div className="py-24 text-center"><Heart className="mx-auto text-[#6b2734]" /><p className="mt-4 font-display text-2xl">A quieter edit is coming.</p><p className="mt-2 text-sm text-[#806b61]">Try another filter.</p></div> : <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">{visible.map((product) => <Link key={product.id} href={`/catalogue/product/${product.id}`} className="group block" data-testid={`link-public-product-${product.id}`}><div className="relative aspect-[.8] overflow-hidden bg-[#dfd3c7]"><img src={imageFor(product)} alt={`${product.brand || 'Luxe Horizon'} ${categoryLabels[product.category]}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /><span className="absolute bottom-3 left-3 font-mono-ui text-[9px] uppercase tracking-[.14em] text-white drop-shadow">{genderLabels[product.gender]}</span></div><div className="mt-3 flex items-start justify-between gap-2"><div><p className="font-display text-xl">{product.brand || 'Luxe Horizon edit'}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-[#806b61]">{categoryLabels[product.category]}</p></div><ArrowUpRight size={15} className="mt-1 text-[#806b61] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div></Link>)}</div>}</section><section id="about" className="border-t border-[#d5c7b9] bg-[#e9dfd3]"><div className="mx-auto grid max-w-[1380px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:py-24"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#7d4c4d]">The house</p><h2 className="mt-4 max-w-sm font-display text-4xl leading-tight sm:text-5xl">Luxury is in the edit.</h2></div><div className="max-w-xl"><p className="font-display text-2xl leading-relaxed text-[#4b3430]">Luxe Horizon is a private shopping house for people who know that the best things are rarely shouting.</p><p className="mt-6 text-sm leading-7 text-[#806b61]">We bring together the pieces worth making room for: quietly distinctive, beautifully made, and chosen for a life beyond the season.</p></div></div></section></main><footer className="border-t border-[#d5c7b9] bg-[#f3eee6]"><div className="mx-auto flex max-w-[1380px] flex-col gap-4 px-5 py-7 text-[10px] uppercase tracking-[.14em] text-[#806b61] sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© Luxe Horizon</span><span>The pinnacle of luxury shopping</span><Link href="/admin/dashboard" className="text-[#6b2734]">Private operations</Link></div></footer></div>;
}

function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const { data: publicProduct, isLoading } = useGetPublicProduct(productId, { query: { enabled: !!productId, queryKey: getGetPublicProductQueryKey(productId), retry: false } });
  const { data: adminProduct } = useGetProduct(productId, { query: { enabled: !!productId, queryKey: getGetProductQueryKey(productId), retry: false } });
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey(), retry: false } });
  const product = publicProduct || adminProduct || fallbackProducts.find((item) => item.id === productId) || fallbackProducts[0];
  const [activeImage, setActiveImage] = useState(0);
  const images = product.images?.length ? product.images : [{ id: 'fallback', imagePath: heroImage, isPrimary: true, sortOrder: 1 }];
  const whatsappNumber = settings?.whatsappNumber || import.meta.env.VITE_LUXE_HORIZON_WHATSAPP || '';
  const publicUrl = `${window.location.origin}/catalogue/product/${product.id}`;
  const whatsappMessage = `Hi Luxe Horizon, I'm interested in this item 👇\n\n${publicUrl}\n\nIs it available?`;
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;
  return <div className="min-h-[100dvh] bg-[#f3eee6] text-[#241b18] noise"><header className="border-b border-[#d5c7b9]"><div className="mx-auto flex h-[76px] max-w-[1380px] items-center justify-between px-5 sm:px-8"><Link href="/catalogue" className="flex items-center gap-2 text-[11px] uppercase tracking-[.14em] text-[#806b61]" data-testid="link-back-catalogue"><ArrowLeft size={15} /> Back to collection</Link><AppLogo /><span className="hidden text-[10px] uppercase tracking-[.17em] text-[#806b61] sm:block">Private edit / 2026</span></div></header><main className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 sm:py-12">{isLoading ? <div className="grid animate-pulse gap-10 md:grid-cols-2"><div className="aspect-[.82] bg-[#e1d5c9]" /><div className="space-y-4 pt-10"><div className="h-4 w-28 bg-[#e1d5c9]" /><div className="h-14 w-3/4 bg-[#e1d5c9]" /></div></div> : <div className="grid gap-10 md:grid-cols-[1.08fr_.92fr] lg:gap-20"><div className="grid gap-3 sm:grid-cols-[82px_1fr]"><div className="order-2 flex gap-2 overflow-auto sm:order-1 sm:flex-col">{images.map((image, index) => <button type="button" key={image.id} onClick={() => setActiveImage(index)} className={`h-20 w-16 shrink-0 overflow-hidden border-2 sm:h-24 sm:w-[74px] ${activeImage === index ? 'border-[#6b2734]' : 'border-transparent'}`} data-testid={`button-product-image-${index}`}><img src={resolveImage(image.imagePath)} alt="" className="h-full w-full object-cover" /></button>)}</div><div className="order-1 aspect-[.82] overflow-hidden bg-[#dfd3c7] sm:order-2"><img src={resolveImage(images[activeImage]?.imagePath)} alt={`${product.brand || 'Luxe Horizon'} ${categoryLabels[product.category]}`} className="h-full w-full object-cover" /></div></div><div className="flex flex-col justify-center"><div className="flex items-center gap-2"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#7d4c4d]">{genderLabels[product.gender]}</span><span className="h-1 w-1 rounded-full bg-[#c8a269]" /><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#7d4c4d]">{categoryLabels[product.category]}</span></div><h1 className="mt-5 max-w-lg font-display text-5xl leading-[1.02] tracking-[-.03em] sm:text-6xl">{product.brand || 'Luxe Horizon edit'}</h1><p className="mt-5 max-w-md text-sm leading-7 text-[#806b61]">A considered piece from the {fallbackCollection.name} edit. Enquire with the house for availability, provenance and private appointments.</p><div className="my-9 border-y border-[#d5c7b9] py-5"><div className="flex items-center justify-between text-xs"><span className="text-[#806b61]">Availability</span><span className="flex items-center gap-2 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> By enquiry</span></div></div><a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6b2734] px-6 py-4 text-xs font-semibold uppercase tracking-[.12em] text-[#f3eee6] transition hover:-translate-y-0.5 hover:shadow-lg" data-testid="link-whatsapp-enquiry"><MessageCircle size={17} /> Enquire via WhatsApp</a><p className="mt-4 text-center text-[10px] uppercase tracking-[.14em] text-[#806b61]">A member of the house will respond personally.</p></div></div>}</main><section className="border-t border-[#d5c7b9] bg-[#e9dfd3]"><div className="mx-auto flex max-w-[1380px] items-center justify-between px-5 py-8 sm:px-8"><p className="font-display text-xl">Continue through the edit.</p><Link href="/catalogue" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#6b2734]">View catalogue <ArrowUpRight size={15} /></Link></div></section></div>;
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-20 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">{icon}</div><h2 className="mt-4 font-display text-2xl">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function Router() {
  return <ErrorBoundary><Switch>
    <Route path="/admin/dashboard" component={DashboardPage} />
    <Route path="/admin/upload" component={UploadPage} />
    <Route path="/admin/review" component={ReviewPage} />
    <Route path="/admin/products" component={ProductsPage} />
    <Route path="/admin/collections" component={CollectionsPage} />
    <Route path="/admin/catalogue" component={CatalogueAdminPage} />
    <Route path="/admin/settings" component={SettingsPage} />
    <Route path="/catalogue/product/:productId" component={ProductDetailPage} />
    <Route path="/catalogue" component={CataloguePage} />
    <Route path="/" component={CataloguePage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;