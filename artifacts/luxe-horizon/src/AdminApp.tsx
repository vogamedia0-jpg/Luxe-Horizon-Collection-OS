import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronRight, CloudUpload, Eye, FolderOpen, Globe2, LayoutDashboard,
  Loader2, LogOut, Menu, Package, Plus, Settings2, Sparkles, Trash2, UploadCloud, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const logo = '/assets/logo.png';
const bucket = 'product-images';

type Collection = {
  id: string; name: string; slug: string; startDate?: string | null; endDate?: string | null;
  isPublished: boolean; publishedAt?: string | null; createdAt: string; updatedAt: string;
};

type Product = {
  id: string; collectionId: string; gender: 'men' | 'women' | 'unknown';
  category: 'clothing' | 'footwear' | 'watches' | 'bags' | 'accessories' | 'other';
  brand?: string | null; aiGender?: string | null; aiCategory?: string | null; aiBrand?: string | null;
  aiConfidence?: number | null; reviewed: boolean; isActive: boolean; isPublished: boolean; sortOrder: number;
  images: { id: string; imagePath: string; isPrimary: boolean; sortOrder: number }[];
};

type Dashboard = {
  collection: Collection | null; totalUploaded: number; men: number; women: number; unknown: number;
  needsReview: number; published: number; categories: Record<string, number>;
};

type SessionState = { ready: boolean; token: string | null };

const categories = ['clothing', 'footwear', 'watches', 'bags', 'accessories', 'other'] as const;
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const imageFor = (product: Product) => product.images.find((image) => image.isPrimary)?.imagePath || product.images[0]?.imagePath || '/assets/brand-board.png';

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function Logo({ light = false }: { light?: boolean }) {
  return <img src={logo} alt="Luxe Horizon" className={`h-9 w-auto object-contain ${light ? 'brightness-0 invert opacity-90' : ''}`} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setPending(true); setError('');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError('Email or password was not accepted.');
    setPending(false);
  };
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-5 text-white noise">
    <form onSubmit={submit} className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[.055] p-7 shadow-2xl sm:p-9">
      <Logo light />
      <p className="mt-10 font-mono-ui text-[9px] uppercase tracking-[.22em] text-[#d9bb8c]">Private operations</p>
      <h1 className="mt-3 font-display text-4xl">Admin sign in</h1>
      <p className="mt-2 text-sm text-white/55">Manage collections, products and publishing.</p>
      <label className="mt-8 block text-xs font-semibold">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none focus:border-[#d9bb8c]" /></label>
      <label className="mt-4 block text-xs font-semibold">Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none focus:border-[#d9bb8c]" /></label>
      {error && <p className="mt-3 text-xs text-[#efb1a5]">{error}</p>}
      <button disabled={pending} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#d9bb8c] text-xs font-semibold text-[#3b2021] disabled:opacity-50">{pending && <Loader2 size={14} className="animate-spin" />} Sign in</button>
    </form>
  </div>;
}

function useAdminSession(): SessionState {
  const [state, setState] = useState<SessionState>({ ready: !isSupabaseConfigured, token: null });
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => mounted && setState({ ready: true, token: data.session?.access_token || null }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ ready: true, token: session?.access_token || null }));
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

const nav = [
  ['/admin/dashboard', 'Overview', LayoutDashboard], ['/admin/upload', 'Upload', CloudUpload], ['/admin/review', 'Review', Eye],
  ['/admin/products', 'Products', Package], ['/admin/collections', 'Collections', FolderOpen], ['/admin/catalogue', 'Publish & links', Globe2],
] as const;

function Shell({ token, children, reviewCount = 0, activeCollection }: { token: string; children: React.ReactNode; reviewCount?: number; activeCollection?: Collection | null }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] noise">
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Logo light /><button className="lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="mt-8 rounded-xl border border-white/10 bg-white/[.055] p-3.5">
        <p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#d9bb8c]">Active collection</p>
        <p className="mt-2 font-display text-[17px] leading-tight">{activeCollection?.name || 'No collection yet'}</p>
        <p className="mt-2 text-[10px] text-white/45">{activeCollection ? (activeCollection.isPublished ? 'Published' : 'Draft') : 'Create your first collection'}</p>
      </div>
      <nav className="mt-7 flex-1 space-y-1">{nav.map(([href, label, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] ${location === href ? 'bg-white/[.12] text-[#e1c18d]' : 'text-white/68 hover:bg-white/[.06] hover:text-white'}`}><Icon size={16} /><span>{label}</span>{label === 'Review' && reviewCount > 0 && <span className="ml-auto rounded-full bg-[#cfa878] px-1.5 py-0.5 text-[9px] font-bold text-[#3b2021]">{reviewCount}</span>}</Link>)}</nav>
      <div className="border-t border-white/10 pt-4">
        <Link href="/admin/settings" className="flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] text-white/68 hover:text-white"><Settings2 size={16} /> Settings</Link>
        <button onClick={() => supabase?.auth.signOut()} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[13px] text-white/55 hover:bg-white/[.06] hover:text-white"><LogOut size={16} /> Sign out</button>
      </div>
    </aside>
    <div className="lg:pl-[264px]">
      <header className="sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/94 px-5 backdrop-blur sm:px-8">
        <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button><div className="hidden text-xs text-[hsl(var(--muted-foreground))] lg:block">Luxe Horizon Collection OS</div><Link href="/catalogue" className="text-xs font-semibold text-[hsl(var(--primary))]">View catalogue</Link>
      </header>
      <main>{children}</main>
    </div>
  </div>;
}

function Intro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-2 font-display text-4xl tracking-[-.03em] sm:text-5xl">{title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p></div>{action}</div>;
}

function Stat({ label, value, detail, accent = false }: { label: string; value: number; detail: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-5 ${accent ? 'border-transparent bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--card-border))] bg-[hsl(var(--card))]'}`}><p className={`font-mono-ui text-[9px] uppercase tracking-[.15em] ${accent ? 'text-white/60' : 'text-[hsl(var(--muted-foreground))]'}`}>{label}</p><p className="mt-3 font-display text-4xl">{value}</p><p className={`mt-2 text-xs ${accent ? 'text-white/55' : 'text-[hsl(var(--muted-foreground))]'}`}>{detail}</p></div>;
}

function DashboardPage({ token, refreshShell }: { token: string; refreshShell: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void api<Dashboard>('/dashboard', token).then(setData).finally(() => setLoading(false)); }, [token]);
  const total = data?.totalUploaded || 0;
  if (loading) return <Page><Loader2 className="animate-spin text-[hsl(var(--primary))]" /></Page>;
  return <Page><Intro eyebrow="Operations" title="Collection overview" description="Live catalogue status from Supabase." action={<Link href="/admin/upload" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-white"><Plus size={15} /> Upload products</Link>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Products" value={total} detail="In active collection" accent /><Stat label="Needs review" value={data?.needsReview || 0} detail="Pending confirmation" /><Stat label="Published" value={data?.published || 0} detail={`${Math.round(((data?.published || 0) / Math.max(total, 1)) * 100)}% of collection`} /><Stat label="Unsorted" value={data?.unknown || 0} detail="Gender not confirmed" /></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:p-8"><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Current collection</p><h2 className="mt-3 font-display text-3xl">{data?.collection?.name || 'No collection created'}</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(data?.collection?.startDate)} — {formatDate(data?.collection?.endDate)}</p><div className="mt-8 grid grid-cols-3 gap-3 border-t border-[hsl(var(--border))] pt-5"><Count label="Men" value={data?.men || 0} /><Count label="Women" value={data?.women || 0} /><Count label="Unknown" value={data?.unknown || 0} /></div></section><section className="rounded-2xl bg-[#e8dfd3] p-6 sm:p-8"><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#74564a]">Actions</p><div className="mt-5 space-y-2"><Quick href="/admin/review" label="Review pending items" /><Quick href="/admin/collections" label="Manage collections" /><Quick href="/admin/catalogue" label="Publish & share" /></div></section></div>
    <section className="mt-5 rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6"><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Category mix</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(data?.categories || {}).map(([name, value]) => <div key={name} className="flex items-center justify-between rounded-xl bg-[hsl(var(--muted))]/60 px-4 py-3 text-sm"><span className="capitalize">{name}</span><strong>{value}</strong></div>)}{Object.keys(data?.categories || {}).length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No products yet.</p>}</div></section>
  </Page>;
}

function Count({ label, value }: { label: string; value: number }) { return <div><p className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
function Quick({ href, label }: { href: string; label: string }) { return <Link href={href} className="flex items-center justify-between rounded-xl bg-[#f7f1e9] px-4 py-4 text-sm font-semibold text-[#3d2926]">{label}<ChevronRight size={15} /></Link>; }
function Page({ children }: { children: React.ReactNode }) { return <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">{children}</div>; }

function UploadPage({ token, collections, reload }: { token: string; collections: Collection[]; reload: () => void }) {
  const [files, setFiles] = useState<File[]>([]); const [collectionId, setCollectionId] = useState(collections[0]?.id || ''); const [hint, setHint] = useState<'mixed' | 'men' | 'women'>('mixed'); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { if (!collectionId && collections[0]) setCollectionId(collections[0].id); }, [collections, collectionId]);
  const submit = async () => {
    if (!supabase || !collectionId || !files.length) return;
    setBusy(true); setMessage('');
    try {
      const paths: string[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
        const path = `${collectionId}/${crypto.randomUUID()}-${safe}`;
        const uploaded = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploaded.error) throw uploaded.error;
        paths.push(path);
      }
      await api('/products/upload', token, { method: 'POST', body: JSON.stringify({ collectionId, batchHint: hint, images: paths.map((imagePath) => ({ imagePath })) }) });
      setFiles([]); setMessage(`${paths.length} product${paths.length === 1 ? '' : 's'} uploaded to the review queue.`); reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    setBusy(false);
  };
  return <Page><Intro eyebrow="Workspace" title="Upload products" description="Images are stored privately in Supabase and products enter the review queue before publishing." />
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:p-8"><label className="block text-xs font-semibold">Collection<select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-transparent px-3">{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="mt-5"><p className="text-xs font-semibold">Batch hint</p><div className="mt-2 grid grid-cols-3 gap-2">{(['mixed','men','women'] as const).map((item) => <button key={item} onClick={() => setHint(item)} className={`rounded-lg border px-3 py-3 text-xs font-semibold capitalize ${hint === item ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.06] text-[hsl(var(--primary))]' : ''}`}>{item}</button>)}</div></div><label className="mt-6 flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#bfae9a] bg-[#f4eee5] px-6 text-center"><UploadCloud size={28} className="text-[hsl(var(--primary))]" /><span className="mt-3 font-display text-2xl">Choose product images</span><span className="mt-2 text-xs text-[#806b61]">JPG, PNG or WEBP</span><input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>{files.length > 0 && <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">{files.length} file{files.length === 1 ? '' : 's'} selected</div>}<div className="mt-5 flex items-center justify-between border-t pt-5"><p className="max-w-[65%] text-xs text-[hsl(var(--muted-foreground))]">{message}</p><button disabled={busy || !files.length || !collectionId} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />} Upload</button></div></section><aside className="rounded-2xl bg-[hsl(var(--sidebar))] p-7 text-white"><Sparkles size={18} className="text-[#d9bb8c]" /><h2 className="mt-5 font-display text-3xl">Review before publish</h2><p className="mt-3 text-sm leading-6 text-white/60">Every uploaded item stays private until its classification is confirmed and publishing is switched on.</p></aside></div>
  </Page>;
}

function ReviewPage({ token, reload }: { token: string; reload: () => void }) {
  const [items, setItems] = useState<Product[]>([]); const [busy, setBusy] = useState('');
  const load = () => api<Product[]>('/products?reviewed=false', token).then(setItems);
  useEffect(() => { void load(); }, [token]);
  const approve = async (product: Product) => { setBusy(product.id); await api(`/products/${product.id}`, token, { method: 'PATCH', body: JSON.stringify({ reviewed: true, gender: product.gender, category: product.category, brand: product.brand || null }) }); await load(); reload(); setBusy(''); };
  return <Page><Intro eyebrow="Workspace" title="Review queue" description="Confirm classification before products are eligible to publish." action={<Link href="/admin/products" className="rounded-full border px-4 py-2.5 text-xs font-semibold">All products</Link>} />{items.length === 0 ? <Empty title="Review queue is clear" text="There are no pending products." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border bg-[hsl(var(--card))]"><div className="aspect-[1.05] bg-[#ded2c5]"><img src={imageFor(product)} alt="" className="h-full w-full object-cover" /></div><div className="p-5"><input value={product.brand || ''} onChange={(e) => setItems((all) => all.map((p) => p.id === product.id ? { ...p, brand: e.target.value } : p))} placeholder="Brand" className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" /><div className="mt-3 grid grid-cols-2 gap-2"><select value={product.gender} onChange={(e) => setItems((all) => all.map((p) => p.id === product.id ? { ...p, gender: e.target.value as Product['gender'] } : p))} className="h-10 rounded-lg border bg-transparent px-2 text-xs"><option value="unknown">Unknown</option><option value="women">Women</option><option value="men">Men</option></select><select value={product.category} onChange={(e) => setItems((all) => all.map((p) => p.id === product.id ? { ...p, category: e.target.value as Product['category'] } : p))} className="h-10 rounded-lg border bg-transparent px-2 text-xs">{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div><button onClick={() => approve(product)} disabled={busy === product.id} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-white">{busy === product.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve</button></div></article>)}</div>}</Page>;
}

function ProductsPage({ token, reload }: { token: string; reload: () => void }) {
  const [items, setItems] = useState<Product[]>([]); const [busy, setBusy] = useState('');
  const load = () => api<Product[]>('/products', token).then(setItems);
  useEffect(() => { void load(); }, [token]);
  const patch = async (id: string, data: object) => { setBusy(id); await api(`/products/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }); await load(); reload(); setBusy(''); };
  const remove = async (id: string) => { if (!window.confirm('Delete this product?')) return; setBusy(id); await api(`/products/${id}`, token, { method: 'DELETE' }); await load(); reload(); setBusy(''); };
  return <Page><Intro eyebrow="Catalogue" title="Products" description="Manage reviewed state, visibility and publishing from one place." />{items.length === 0 ? <Empty title="No products yet" text="Upload the first product batch to begin." /> : <div className="overflow-hidden rounded-2xl border bg-[hsl(var(--card))]">{items.map((product) => <div key={product.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b p-3 last:border-0 sm:grid-cols-[64px_1fr_110px_110px_120px]"><img src={imageFor(product)} alt="" className="h-14 w-14 rounded-lg object-cover" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{product.brand || 'Unbranded'}</p><p className="mt-1 text-[10px] capitalize text-[hsl(var(--muted-foreground))]">{product.gender} · {product.category}</p></div><span className="hidden text-xs sm:block">{product.reviewed ? 'Reviewed' : 'Pending'}</span><span className="hidden text-xs sm:block">{product.isPublished ? 'Published' : 'Draft'}</span><div className="flex items-center justify-end gap-2"><button disabled={!product.reviewed || busy === product.id} onClick={() => patch(product.id, { isPublished: !product.isPublished })} className="rounded-full border px-3 py-2 text-[10px] font-semibold disabled:opacity-35">{product.isPublished ? 'Unpublish' : 'Publish'}</button><button onClick={() => remove(product.id)} className="rounded-full p-2 text-[hsl(var(--destructive))]"><Trash2 size={14} /></button></div></div>)}</div>}</Page>;
}

function CollectionsPage({ token, collections, reload }: { token: string; collections: Collection[]; reload: () => void }) {
  const [name, setName] = useState(''); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [busy, setBusy] = useState(false);
  const create = async () => { if (!name.trim()) return; setBusy(true); const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-5)}`; await api('/collections', token, { method: 'POST', body: JSON.stringify({ name: name.trim(), slug, startDate: startDate || null, endDate: endDate || null }) }); setName(''); setStartDate(''); setEndDate(''); reload(); setBusy(false); };
  const publish = async (collection: Collection) => { await api(`/collections/${collection.id}`, token, { method: 'PATCH', body: JSON.stringify({ isPublished: !collection.isPublished }) }); reload(); };
  return <Page><Intro eyebrow="Catalogue" title="Collections" description="Create weekly edits and control which collection is public." /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-2xl border bg-[hsl(var(--card))] p-6"><h2 className="font-display text-2xl">New collection</h2><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" className="mt-5 h-11 w-full rounded-lg border bg-transparent px-3 text-sm" /><div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-lg border bg-transparent px-3 text-xs" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 rounded-lg border bg-transparent px-3 text-xs" /></div><button disabled={busy || !name.trim()} onClick={create} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"><Plus size={14} /> Create</button></section><section className="overflow-hidden rounded-2xl border bg-[hsl(var(--card))]">{collections.length === 0 ? <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">No collections yet.</div> : collections.map((collection) => <div key={collection.id} className="flex items-center justify-between gap-4 border-b p-5 last:border-0"><div><p className="font-display text-xl">{collection.name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(collection.startDate)} — {formatDate(collection.endDate)}</p></div><button onClick={() => publish(collection)} className={`rounded-full px-4 py-2 text-xs font-semibold ${collection.isPublished ? 'bg-[hsl(var(--primary))] text-white' : 'border'}`}>{collection.isPublished ? 'Published' : 'Publish'}</button></div>)}</section></div></Page>;
}

function PublishPage({ dashboard }: { dashboard: Dashboard | null }) {
  const copy = async () => { await navigator.clipboard.writeText(`${window.location.origin}/catalogue`); };
  return <Page><Intro eyebrow="Catalogue" title="Publish & links" description="Share the live catalogue after products and the active collection are published." /><div className="overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))] text-white"><div className="grid md:grid-cols-[1fr_.8fr]"><div className="p-7 sm:p-10"><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#d9bb8c]">Public catalogue</p><h2 className="mt-4 font-display text-4xl">{dashboard?.collection?.name || 'No collection published'}</h2><p className="mt-3 text-sm text-white/55">{dashboard?.published || 0} products currently published.</p><div className="mt-7 flex gap-3"><Link href="/catalogue" className="rounded-full bg-[#d9bb8c] px-5 py-3 text-xs font-semibold text-[#3b2021]">View catalogue</Link><button onClick={copy} className="rounded-full border border-white/20 px-5 py-3 text-xs font-semibold">Copy link</button></div></div><img src="/assets/brand-board.png" alt="" className="min-h-[260px] h-full w-full object-cover opacity-70" /></div></div></Page>;
}

function SettingsPage() { return <Page><Intro eyebrow="Settings" title="Configuration" description="Account and deployment settings for Luxe Horizon." /><div className="rounded-2xl border bg-[hsl(var(--card))] p-6 sm:p-8"><h2 className="font-display text-2xl">WhatsApp enquiries</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">The customer enquiry number is configured through the deployment environment variable <strong>VITE_LUXE_HORIZON_WHATSAPP</strong>. This keeps the V1 setup simple and avoids a separate settings table.</p><h2 className="mt-8 font-display text-2xl">Supabase</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Authentication, catalogue data and private product images use the existing Luxe Horizon Supabase project.</p></div></Page>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border bg-[hsl(var(--card))] px-6 py-20 text-center"><CheckCircle2 className="mx-auto text-[hsl(var(--primary))]" /><h2 className="mt-4 font-display text-2xl">{title}</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{text}</p></div>; }

function AdminRoutes({ token }: { token: string }) {
  const [collections, setCollections] = useState<Collection[]>([]); const [dashboard, setDashboard] = useState<Dashboard | null>(null); const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => { void Promise.all([api<Collection[]>('/collections', token), api<Dashboard>('/dashboard', token)]).then(([c,d]) => { setCollections(c); setDashboard(d); }); }, [token, version]);
  const active = dashboard?.collection || collections.find((c) => c.isPublished) || collections[0] || null;
  return <Shell token={token} reviewCount={dashboard?.needsReview || 0} activeCollection={active}><Switch><Route path="/admin/dashboard">{() => <DashboardPage token={token} refreshShell={reload} />}</Route><Route path="/admin/upload">{() => <UploadPage token={token} collections={collections} reload={reload} />}</Route><Route path="/admin/review">{() => <ReviewPage token={token} reload={reload} />}</Route><Route path="/admin/products">{() => <ProductsPage token={token} reload={reload} />}</Route><Route path="/admin/collections">{() => <CollectionsPage token={token} collections={collections} reload={reload} />}</Route><Route path="/admin/catalogue">{() => <PublishPage dashboard={dashboard} />}</Route><Route path="/admin/settings">{() => <SettingsPage />}</Route><Route>{() => <DashboardPage token={token} refreshShell={reload} />}</Route></Switch></Shell>;
}

export default function AdminApp() {
  const session = useAdminSession();
  if (!isSupabaseConfigured) return <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center"><div><h1 className="font-display text-3xl">Supabase configuration required</h1><p className="mt-3 max-w-md text-sm text-[hsl(var(--muted-foreground))]">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to run the admin application.</p></div></div>;
  if (!session.ready) return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="animate-spin text-[hsl(var(--primary))]" /></div>;
  if (!session.token) return <Login />;
  return <AdminRoutes token={session.token} />;
}
