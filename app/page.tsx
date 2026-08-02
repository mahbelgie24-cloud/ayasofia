export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-3xl font-semibold text-brand-ink">
          Ayasofia Sweet
        </h1>
        <p className="text-lg text-zinc-600">
          Internal operations system. Routes available at:
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm font-medium">
          <a href="/pos" className="rounded-full bg-brand-red px-5 py-2 text-white">POS</a>
          <a href="/kitchen" className="rounded-full bg-brand-red px-5 py-2 text-white">Kitchen</a>
          <a href="/drive-thru" className="rounded-full bg-brand-red px-5 py-2 text-white">Drive-Thru</a>
          <a href="/order/demo" className="rounded-full bg-brand-red px-5 py-2 text-white">Order</a>
          <a href="/admin" className="rounded-full bg-brand-red px-5 py-2 text-white">Admin</a>
        </div>
      </main>
    </div>
  );
}
