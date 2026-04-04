'use client';

import type { TrainingJobStatus } from '@/types/builder';

type TopBarProps = {
  activeWorkspace: 'builder' | 'tutorial' | 'competition';
  trainingStatus: TrainingJobStatus | null;
  isTraining: boolean;
  onWorkspaceSelect: (workspace: 'builder' | 'tutorial' | 'competition') => void;
  onLogoClick: () => void;
};

export function TopBar({
  activeWorkspace,
  trainingStatus: _trainingStatus,
  isTraining: _isTraining,
  onWorkspaceSelect,
  onLogoClick,
}: TopBarProps) {
  const workspaceTabs = [
    { id: 'tutorial', label: 'Tutorial' },
    { id: 'builder', label: 'Lab' },
    { id: 'competition', label: 'Competition' },
  ] as const;

  return (
    <header className="ui-surface px-3 py-3 md:px-4 md:py-4 lg:px-4 lg:py-4">
      <section className="ui-subtle-surface min-w-0 px-[clamp(18px,1.2vw,26px)] py-[clamp(16px,1.1vw,20px)]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-10 gap-y-4 xl:gap-x-14">
          <div className="shrink-0">
            <button
              type="button"
              onClick={onLogoClick}
              className="font-display text-[clamp(2.4rem,2.8vw,3.4rem)] font-bold tracking-[-0.075em] text-primary transition-opacity hover:opacity-85"
            >
              VisAible
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex w-fit min-w-0 flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/55 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm">
              {workspaceTabs.map((tab) => {
                const active = activeWorkspace === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onWorkspaceSelect(tab.id)}
                    className={[
                      'relative rounded-full px-5 py-2.5 font-display text-[14px] font-bold tracking-[0.01em] transition-all',
                      active
                        ? 'bg-[#eef4ff] text-primary shadow-[0_8px_20px_rgba(54,104,255,0.12)]'
                        : 'text-[#6e7f99] hover:bg-white/60 hover:text-[#244ea8]',
                    ].join(' ')}
                  >
                    {tab.label}
                    <span
                      className={[
                        'absolute inset-x-4 bottom-[4px] h-[2.5px] rounded-full transition-all',
                        active ? 'bg-primary opacity-100' : 'bg-transparent opacity-0',
                      ].join(' ')}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </header>
  );
}
