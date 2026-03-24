import { stats } from '@/lib/constants/builder-data';

export function Inspector() {
  return (
    <aside className="grid content-start gap-4 bg-[linear-gradient(180deg,#fbfcff_0%,#f7f9ff_100%)] p-4">

      <section className="rounded-[22px] bg-panel/80 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <strong className="font-display text-lg font-bold text-ink">Decision Boundary</strong>
          <span className="text-muted">↗</span>
        </div>
        <div className="relative h-[270px] overflow-hidden rounded-[18px] bg-white/85">
          <div className="absolute inset-x-[-20px] bottom-[-10px] top-[118px] rounded-[46%_34%_24%_8%/28%_22%_26%_12%] bg-[rgba(194,212,251,0.45)]" />
          <span className="absolute left-[46px] top-[56px] h-2 w-2 rounded-full bg-[#6695ff]" />
          <span className="absolute left-[148px] top-[68px] h-2 w-2 rounded-full bg-[#6695ff]" />
          <span className="absolute left-[98px] top-[130px] h-2 w-2 rounded-full bg-[#6695ff]" />
          <span className="absolute left-[224px] top-[218px] h-2 w-2 rounded-full bg-[#5d93a6]" />
          <span className="absolute left-[184px] top-[268px] h-2 w-2 rounded-full bg-[#5d93a6]" />
          <span className="absolute left-[262px] top-[244px] h-2 w-2 rounded-full bg-[#5d93a6]" />

          <div className="absolute bottom-3 right-4 flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-primary" />
              Class A
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-tertiary" />
              Class B
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] bg-panel/80 p-3.5">
        <div className="mb-3 flex items-start justify-between">
          <strong className="font-display text-lg font-bold text-ink">Training Metrics</strong>
          <div className="flex gap-3 text-xs font-extrabold uppercase tracking-[0.16em]">
            <button type="button" className="text-primary">
              Loss
            </button>
            <button type="button" className="text-muted">
              Acc
            </button>
          </div>
        </div>

        <div className="rounded-[18px] bg-white/85 p-3">
          <svg viewBox="0 0 320 180" preserveAspectRatio="none" className="h-[160px] w-full">
            <path
              d="M0 36H320M0 90H320M0 144H320"
              fill="none"
              stroke="rgba(129,149,188,0.26)"
            />
            <path
              d="M0 142 C32 130, 50 98, 84 78 S130 90, 164 72 S220 28, 274 18"
              fill="none"
              stroke="#1151ff"
              strokeWidth="4"
            />
            <path
              d="M0 168 C30 152, 62 124, 95 120 S138 126, 172 108 S228 76, 274 68"
              fill="none"
              stroke="#0a607f"
              strokeWidth="4"
            />
          </svg>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              Final Loss
            </span>
            <strong className="font-display text-[2rem] font-bold text-primary">0.0241</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              Final Acc
            </span>
            <strong className="font-display text-[2rem] font-bold text-tertiary">98.2%</strong>
          </div>
        </div>
      </section>

      <section className="grid gap-4 px-1 pt-1">
        {stats.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-6">
            <span className="text-base text-[#364761]">{item.label}</span>
            <strong className="font-display text-base font-bold text-ink">{item.value}</strong>
          </div>
        ))}
        <div className="h-[5px] overflow-hidden rounded-full bg-primary/10">
          <span className="block h-full w-[48%] bg-[linear-gradient(90deg,#1151ff,#3a6cff)]" />
        </div>
      </section>
    </aside>
  );
}
