import dynamic from 'next/dynamic';

const BuilderShell = dynamic(
  () => import('@/features/model-builder/components/builder-shell').then((module) => module.BuilderShell),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-hero-fade text-ink">
        <div className="rounded-[24px] bg-white/80 px-6 py-4 text-sm font-semibold shadow-panel">
          Loading VisAible...
        </div>
      </main>
    ),
  },
);

export default function HomePage() {
  return <BuilderShell />;
}
