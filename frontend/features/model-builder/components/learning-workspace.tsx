'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Document, Page, pdfjs } from 'react-pdf';
import { Icon } from '@/features/model-builder/components/icons';
import {
  chatWithLearning,
  getLearningChapter,
  getLearningChapterPdfUrl,
  listLearningChapters,
  type LearningChapterContent,
  type LearningChapterSummary,
} from '@/lib/api/learning';

type LearningMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  imagePreviewUrl?: string | null;
  imageName?: string | null;
};

type DroppedImage = {
  name: string;
  mimeType: string;
  base64: string;
  previewUrl: string;
};

type PdfRegionImage = {
  file: File;
  dataUrl: string;
  pageNumber: number;
};

type PdfSelectionDraft = {
  pageNumber: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type PdfSelectionBox = {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('내용을 읽지 못했습니다.'));
    };
    reader.onerror = () => reject(new Error('내용을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function compactText(text: string, maxLength = 2400) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}

async function imageFileToDroppedImage(file: File): Promise<DroppedImage> {
  const dataUrl = await fileToDataUrl(file);
  const [, base64 = ''] = dataUrl.split(',', 2);
  return {
    name: file.name || 'pdf-image.png',
    mimeType: file.type || 'image/png',
    base64,
    previewUrl: dataUrl,
  };
}

function dataUrlToDroppedImage(name: string, dataUrl: string): DroppedImage | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }

  return {
    name,
    mimeType: match[1],
    base64: match[2],
    previewUrl: dataUrl,
  };
}

function getImageFile(dataTransfer: DataTransfer) {
  const file = Array.from(dataTransfer.files).find((item) => item.type.startsWith('image/'));
  if (file) {
    return file;
  }

  const imageItem = Array.from(dataTransfer.items).find((item) => item.kind === 'file' && item.type.startsWith('image/'));
  return imageItem?.getAsFile() ?? null;
}

function getPdfRegionImage(dataTransfer: DataTransfer): DroppedImage | null {
  const rawPayload = dataTransfer.getData('application/x-visaible-pdf-region');
  if (!rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as { name?: unknown; dataUrl?: unknown };
    if (typeof payload.dataUrl !== 'string') {
      return null;
    }

    return dataUrlToDroppedImage(typeof payload.name === 'string' ? payload.name : 'pdf-selection.png', payload.dataUrl);
  } catch {
    return null;
  }
}

function getSelectionBox(selection: PdfSelectionDraft | null): PdfSelectionBox | null {
  if (!selection) {
    return null;
  }

  const left = Math.min(selection.startX, selection.endX);
  const top = Math.min(selection.startY, selection.endY);
  const width = Math.abs(selection.endX - selection.startX);
  const height = Math.abs(selection.endY - selection.startY);

  if (width < 8 || height < 8) {
    return null;
  }

  return {
    pageNumber: selection.pageNumber,
    left,
    top,
    width,
    height,
  };
}

async function canvasBlobToFile(canvas: HTMLCanvasElement, fileName: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('선택 영역을 내용으로 만들지 못했습니다.');
  }

  return new File([blob], fileName, { type: 'image/png' });
}

async function capturePdfSelection(pageShell: HTMLElement, box: PdfSelectionBox, chapterId: string): Promise<PdfRegionImage> {
  const sourceCanvas = pageShell.querySelector<HTMLCanvasElement>('.react-pdf__Page__canvas');
  if (!sourceCanvas) {
    throw new Error('PDF 페이지 캔버스를 찾지 못했습니다.');
  }

  const canvasRect = sourceCanvas.getBoundingClientRect();
  const shellRect = pageShell.getBoundingClientRect();
  const sourceX = Math.max(0, (box.left + shellRect.left - canvasRect.left) * (sourceCanvas.width / canvasRect.width));
  const sourceY = Math.max(0, (box.top + shellRect.top - canvasRect.top) * (sourceCanvas.height / canvasRect.height));
  const sourceWidth = Math.min(sourceCanvas.width - sourceX, box.width * (sourceCanvas.width / canvasRect.width));
  const sourceHeight = Math.min(sourceCanvas.height - sourceY, box.height * (sourceCanvas.height / canvasRect.height));

  if (sourceWidth < 2 || sourceHeight < 2) {
    throw new Error('선택 영역이 너무 작습니다.');
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = Math.round(sourceWidth);
  outputCanvas.height = Math.round(sourceHeight);

  const context = outputCanvas.getContext('2d');
  if (!context) {
    throw new Error('내용 캡처 컨텍스트를 만들지 못했습니다.');
  }

  context.drawImage(sourceCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputCanvas.width, outputCanvas.height);

  const dataUrl = outputCanvas.toDataURL('image/png');
  const file = await canvasBlobToFile(outputCanvas, `learning-${chapterId}-p${box.pageNumber}-selection.png`);
  return { file, dataUrl, pageNumber: box.pageNumber };
}

function PdfSelectionViewer({
  chapter,
  pdfUrl,
  onError,
}: {
  chapter: LearningChapterContent;
  pdfUrl: string;
  onError: (message: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const wheelLockRef = useRef(0);
  const [viewerWidth, setViewerWidth] = useState(720);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionDraft, setSelectionDraft] = useState<PdfSelectionDraft | null>(null);
  const [capturedRegion, setCapturedRegion] = useState<PdfRegionImage | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const selectionBox = useMemo(() => getSelectionBox(selectionDraft), [selectionDraft]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setViewerWidth(Math.max(320, Math.min(980, element.clientWidth - 32)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPageCount(0);
    setCurrentPage(1);
    setSelectionDraft(null);
    setCapturedRegion(null);
  }, [chapter.id]);

  const goToPage = (pageNumber: number) => {
    const nextPage = Math.min(Math.max(pageNumber, 1), Math.max(pageCount, 1));
    setCurrentPage(nextPage);
    setSelectionDraft(null);
    setCapturedRegion(null);
    scrollRef.current?.querySelector('[data-pdf-page-scroll]')?.scrollTo({ top: 0 });
  };

  const handlePageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isSelecting || pageCount <= 1 || Math.abs(event.deltaY) < 28) {
      return;
    }

    const target = event.currentTarget;
    const atTop = target.scrollTop <= 2;
    const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 2;
    if ((event.deltaY > 0 && !atBottom) || (event.deltaY < 0 && !atTop)) {
      return;
    }

    const now = Date.now();
    if (now - wheelLockRef.current < 260) {
      return;
    }

    wheelLockRef.current = now;
    goToPage(currentPage + (event.deltaY > 0 ? 1 : -1));
  };

  const startSelection = (event: React.PointerEvent<HTMLDivElement>, pageNumber: number) => {
    if (event.button !== 0) {
      return;
    }

    const shell = pageRefs.current[pageNumber];
    if (!shell) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setIsSelecting(true);
    setCapturedRegion(null);
    setSelectionDraft({ pageNumber, startX: x, startY: y, endX: x, endY: y });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const updateSelection = (event: React.PointerEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isSelecting || selectionDraft?.pageNumber !== pageNumber) {
      return;
    }

    const shell = pageRefs.current[pageNumber];
    if (!shell) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    setSelectionDraft((current) =>
      current
        ? {
            ...current,
            endX: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
            endY: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
          }
        : current,
    );
  };

  const finishSelection = async (event: React.PointerEvent<HTMLDivElement>, pageNumber: number) => {
    if (!isSelecting || selectionDraft?.pageNumber !== pageNumber) {
      return;
    }

    setIsSelecting(false);
    event.currentTarget.releasePointerCapture(event.pointerId);

    const nextBox = getSelectionBox(selectionDraft);
    const shell = pageRefs.current[pageNumber];
    if (!nextBox || !shell) {
      setSelectionDraft(null);
      return;
    }

    try {
      setCapturedRegion(await capturePdfSelection(shell, nextBox, chapter.id));
      onError(null);
    } catch (error) {
      setSelectionDraft(null);
      setCapturedRegion(null);
      onError(error instanceof Error ? error.message : '선택 영역 캡처에 실패했습니다.');
    }
  };

  return (
    <div ref={scrollRef} className="learning-pdf-scroll grid h-full min-h-[640px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#eef4ff]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe5f1] bg-white/82 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="rounded-[12px] border border-[#dbe5f1] bg-white px-3 py-2 text-[12px] font-extrabold text-[#24405f] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={pageCount === 0 || currentPage >= pageCount}
            onClick={() => goToPage(currentPage + 1)}
            className="rounded-[12px] border border-[#dbe5f1] bg-white px-3 py-2 text-[12px] font-extrabold text-[#24405f] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>

        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[12px] font-extrabold text-[#60718a]">
          <span className="shrink-0 text-primary">Page</span>
          <input
            type="range"
            min={1}
            max={Math.max(pageCount, 1)}
            value={currentPage}
            disabled={pageCount <= 1}
            onChange={(event) => goToPage(Number(event.target.value))}
            className="h-1.5 min-w-0 flex-1 accent-primary"
          />
          <span className="shrink-0 tabular-nums text-[#24405f]">
            {currentPage} / {pageCount || '-'}
          </span>
        </label>

        <input
          type="number"
          min={1}
          max={Math.max(pageCount, 1)}
          value={currentPage}
          disabled={pageCount === 0}
          onChange={(event) => goToPage(Number(event.target.value) || 1)}
          className="h-9 w-20 rounded-[12px] border border-[#dbe5f1] bg-white px-2 text-center text-[12px] font-extrabold text-[#24405f] outline-none focus:border-primary"
          aria-label="PDF page number"
        />
      </div>

      <div data-pdf-page-scroll className="min-h-0 overflow-auto px-4 py-4" onWheel={handlePageWheel}>
      <Document
        key={chapter.id}
        file={pdfUrl}
        loading={<div className="grid min-h-[560px] place-items-center text-[13px] font-semibold text-[#60718a]">PDF를 렌더링하는 중입니다...</div>}
        error={<div className="grid min-h-[560px] place-items-center px-6 text-center text-[13px] font-semibold text-[#b42318]">PDF를 렌더링하지 못했습니다. Open PDF로 원본을 열어주세요.</div>}
        onLoadSuccess={({ numPages }) => {
          setPageCount(numPages);
          setCurrentPage(1);
        }}
      >
        {pageCount > 0 ? (
          (() => {
            const pageNumber = currentPage;
            const activeBox = selectionBox?.pageNumber === pageNumber ? selectionBox : null;
            const activeCapture = capturedRegion?.pageNumber === pageNumber ? capturedRegion : null;

            return (
            <div
              key={`${chapter.id}-${pageNumber}`}
              ref={(element) => {
                pageRefs.current[pageNumber] = element;
              }}
              className="learning-pdf-page-shell relative mx-auto mb-4 w-fit overflow-hidden rounded-[14px] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.11)]"
              onPointerDown={(event) => startSelection(event, pageNumber)}
              onPointerMove={(event) => updateSelection(event, pageNumber)}
              onPointerUp={(event) => void finishSelection(event, pageNumber)}
              onPointerCancel={() => {
                setIsSelecting(false);
                setSelectionDraft(null);
              }}
            >
              <Page pageNumber={pageNumber} width={viewerWidth} renderAnnotationLayer={false} renderTextLayer />
              {activeBox ? (
                <div
                  className="pointer-events-none absolute border-2 border-primary bg-primary/12 shadow-[0_0_0_9999px_rgba(15,23,42,0.08)]"
                  style={{
                    left: activeBox.left,
                    top: activeBox.top,
                    width: activeBox.width,
                    height: activeBox.height,
                  }}
                />
              ) : null}
              {activeBox && activeCapture ? (
                <div
                  draggable
                  onPointerDown={(event) => event.stopPropagation()}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy';
                    try {
                      event.dataTransfer.items.add(activeCapture.file);
                    } catch {
                      // Some browsers only allow string data in custom drag payloads.
                    }
                    event.dataTransfer.setData(
                      'application/x-visaible-pdf-region',
                      JSON.stringify({
                        name: activeCapture.file.name,
                        dataUrl: activeCapture.dataUrl,
                      }),
                    );
                    event.dataTransfer.setData('text/plain', `PDF page ${pageNumber} selected region`);
                  }}
                  className="absolute grid cursor-grab place-items-center rounded-[12px] border-2 border-primary bg-white/86 px-3 py-2 text-center text-[11px] font-extrabold text-primary shadow-[0_10px_28px_rgba(17,81,255,0.18)] backdrop-blur"
                  style={{
                    left: activeBox.left,
                    top: activeBox.top,
                    width: Math.max(activeBox.width, 132),
                    minHeight: Math.max(activeBox.height, 48),
                  }}
                >
                  Mina에게 드래그
                </div>
              ) : null}
            </div>
            );
          })()
        ) : null}
      </Document>
      </div>
    </div>
  );
}

export function LearningWorkspace() {
  const [chapters, setChapters] = useState<LearningChapterSummary[]>([]);
  const [activeChapterId, setActiveChapterId] = useState('');
  const [activeChapter, setActiveChapter] = useState<LearningChapterContent | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [selectedExcerpt, setSelectedExcerpt] = useState<string | null>(null);
  const [droppedImage, setDroppedImage] = useState<DroppedImage | null>(null);
  const [draft, setDraft] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activePdfUrl = activeChapter ? getLearningChapterPdfUrl(activeChapter.id) : null;
  const [messages, setMessages] = useState<LearningMessage[]>([
    {
      id: 'learning-assistant-intro',
      role: 'assistant',
      content:
        '안녕, 나는 Mina야. PDF에서 궁금한 영역을 캡처해서 놓으면 그 내용을 같이 보면서 설명해줄게.',
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadChapters() {
      setChapterError(null);
      try {
        const nextChapters = await listLearningChapters();
        if (cancelled) {
          return;
        }
        setChapters(nextChapters);
        setActiveChapterId((current) => current || nextChapters[0]?.id || '');
      } catch (error) {
        if (!cancelled) {
          setChapterError(error instanceof Error ? error.message : 'Learning chapter list를 불러오지 못했습니다.');
        }
      }
    }

    void loadChapters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeChapterId) {
      return;
    }

    let cancelled = false;

    async function loadChapter() {
      setLoadingChapter(true);
      setChapterError(null);
      try {
        const nextChapter = await getLearningChapter(activeChapterId);
        if (cancelled) {
          return;
        }
        setActiveChapter(nextChapter);
        setSelectedExcerpt(null);
        setDroppedImage(null);
        setChatError(null);
      } catch (error) {
        if (!cancelled) {
          setChapterError(error instanceof Error ? error.message : 'Learning chapter를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoadingChapter(false);
        }
      }
    }

    void loadChapter();
    return () => {
      cancelled = true;
    };
  }, [activeChapterId]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatBusy, selectedExcerpt, droppedImage]);

  const attachText = (text: string) => {
    const nextText = compactText(text);
    if (!nextText) {
      return false;
    }

    setSelectedExcerpt(nextText);
    setDroppedImage(null);
    setDraft((current) => current || '이 부분 설명해줘.');
    setChatError(null);
    return true;
  };

  const attachImage = (image: DroppedImage) => {
    setDroppedImage(image);
    setSelectedExcerpt(null);
    setDraft((current) => current || '이 내용 설명해줘.');
    setChatError(null);
  };

  const handleClipboardPaste = async (clipboardData: DataTransfer | null) => {
    if (!clipboardData) {
      return false;
    }

    const imageFile = getImageFile(clipboardData);
    if (imageFile) {
      try {
        attachImage(await imageFileToDroppedImage(imageFile));
        return true;
      } catch (error) {
        setChatError(error instanceof Error ? error.message : '클립보드 내용을 읽지 못했습니다.');
        return false;
      }
    }

    return attachText(clipboardData.getData('text/plain'));
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragActive(false);
    setChatError(null);

    const imageFile = getImageFile(event.dataTransfer);
    if (imageFile) {
      try {
        attachImage(await imageFileToDroppedImage(imageFile));
        return;
      } catch (error) {
        setChatError(error instanceof Error ? error.message : '내용 드롭을 처리하지 못했습니다.');
        return;
      }
    }

    const pdfRegionImage = getPdfRegionImage(event.dataTransfer);
    if (pdfRegionImage) {
      attachImage(pdfRegionImage);
      return;
    }

    if (attachText(event.dataTransfer.getData('text/plain'))) {
      return;
    }

    setChatError('텍스트 또는 내용으로 인식할 수 있는 드롭 데이터가 없습니다.');
  };

  const handleSend = async () => {
    const question = draft.trim();
    if (!question || !activeChapter || chatBusy) {
      return;
    }

    const lectureContext = [
      activeChapter.title,
      activeChapter.summary,
      selectedExcerpt ? `Selected excerpt: ${selectedExcerpt}` : null,
      droppedImage ? `Dropped content: ${droppedImage.name}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const userMessage: LearningMessage = {
      id: `learning-user-${Date.now()}`,
      role: 'user',
      content: selectedExcerpt
        ? `${question}\n\n[드롭한 텍스트]\n${compactText(selectedExcerpt)}`
        : droppedImage
          ? `${question}\n\n[드롭한 내용]\n${droppedImage.name}`
          : question,
      imagePreviewUrl: droppedImage?.previewUrl ?? null,
      imageName: droppedImage?.name ?? null,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setChatBusy(true);
    setChatError(null);

    try {
      const response = await chatWithLearning({
        question,
        chapterId: activeChapter.id,
        chapterTitle: activeChapter.title,
        sourceLabel: activeChapter.sourceLabel,
        sourceUrl: activeChapter.sourceUrl,
        lectureContext,
        selectedExcerpt,
        selectedImageBase64: droppedImage?.base64 ?? null,
        selectedImageMimeType: droppedImage?.mimeType ?? null,
      });

      setMessages((current) => [
        ...current,
        {
          id: `learning-assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
        },
      ]);
      setSelectedExcerpt(null);
      setDroppedImage(null);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Mina 답변을 받아오지 못했습니다.');
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <section className="grid min-h-0 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_380px]">
      <aside className="ui-surface min-h-0 overflow-y-auto px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-section-title">Learning</div>
            <div className="mt-2 font-display text-[24px] font-bold text-[#10213b]">
              PDF Map
            </div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#eef4ff] text-primary">
            <Icon name="file" className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid gap-2.5">
          {chapters.map((chapter, index) => {
            const active = chapter.id === activeChapterId;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setActiveChapterId(chapter.id)}
                className={[
                  'w-full rounded-[18px] border px-3.5 py-3 text-left transition',
                  active
                    ? 'border-primary/25 bg-[#eef4ff] shadow-[0_10px_24px_rgba(17,81,255,0.08)]'
                    : 'border-[#dbe5f1] bg-white hover:border-[#bdd0eb] hover:bg-[#f8fbff]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#6b7f9a]">
                    {String(index + 1).padStart(2, '0')} · {chapter.chapterLabel}
                  </div>
                  {active ? <Icon name="check" className="h-4 w-4 text-primary" /> : null}
                </div>
                <div className="mt-2 text-[15px] font-extrabold leading-5 text-[#10213b]">
                  {chapter.title}
                </div>
                <div className="mt-2 line-clamp-3 text-[12px] leading-5 text-[#60718a]">
                  {chapter.summary}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="ui-surface grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e1e8f3] pb-4">
          <div className="min-w-0">
            <div className="ui-section-title">{activeChapter?.chapterLabel ?? 'PDF'}</div>
            <h2 className="mt-2 font-display text-[28px] font-bold leading-tight text-[#10213b]">
              {activeChapter?.title ?? 'Learning PDF'}
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#60718a]">
              {activeChapter?.summary ?? '학습 자료를 불러오는 중입니다.'}
            </p>
          </div>
          {activeChapter?.sourceUrl ? (
            <a
              href={activeChapter.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#dbe5f1] bg-white px-3.5 py-2 text-[12px] font-extrabold text-[#24405f] shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
            >
              <Icon name="file" className="h-4 w-4 text-primary" />
              Open PDF
            </a>
          ) : null}
        </div>

        <div className="mt-4 min-h-0 overflow-hidden rounded-[20px] border border-[#dbe5f1] bg-[#eef4ff]">
          {loadingChapter ? (
            <div className="grid h-full min-h-[640px] place-items-center text-[13px] font-semibold text-[#60718a]">
              PDF를 불러오는 중입니다...
            </div>
          ) : chapterError ? (
            <div className="grid h-full min-h-[640px] place-items-center px-6 text-center text-[13px] font-semibold text-[#b42318]">
              {chapterError}
            </div>
          ) : activeChapter && activePdfUrl ? (
            <PdfSelectionViewer chapter={activeChapter} pdfUrl={activePdfUrl} onError={setChatError} />
          ) : (
            <div className="grid h-full min-h-[640px] place-items-center text-[13px] font-semibold text-[#60718a]">
              PDF를 선택해 주세요.
            </div>
          )}
        </div>
      </main>

      <aside
        className={[
          'ui-surface relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 px-4 py-4 transition',
          dragActive ? 'ring-2 ring-primary/45' : '',
        ].join(' ')}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => void handleDrop(event)}
        onPaste={(event) => {
          void handleClipboardPaste(event.clipboardData);
        }}
      >
        <div className="relative overflow-hidden rounded-[22px] border border-[#dbe5f1] bg-[linear-gradient(135deg,#f8fbff,#eef4ff)] px-4 py-4 shadow-[0_12px_26px_rgba(17,81,255,0.07)]">
          <div className="absolute bottom-0 right-7 h-[118px] w-[84px] opacity-95">
            <Image
              src="/images/mnist-quest-mina-focused.svg"
              alt="Mina"
              fill
              sizes="84px"
              className="object-contain drop-shadow-[0_18px_26px_rgba(17,81,255,0.16)] animate-mascot-float"
            />
          </div>
          <div className="relative max-w-[230px]">
            <div className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#10213b] shadow-[0_8px_16px_rgba(15,23,42,0.08)]">
              Mina
            </div>
            <div className="mt-3 font-display text-[24px] font-bold text-[#10213b]">
              Learning Guide
            </div>
            <div className="mt-2 text-[12px] leading-5 text-[#60718a]">
              PDF 영역 캡처 또는 파일을 드롭하면 여기에 첨부됩니다.
            </div>
          </div>
        </div>

        <div ref={messagesRef} className="min-h-0 space-y-3 overflow-y-auto rounded-[20px] border border-[#dbe5f1] bg-[#f8fbff] px-3 py-3">
          {messages.map((message) =>
            message.role === 'assistant' ? (
              <div
                key={message.id}
                className="rounded-[18px] rounded-tl-[8px] border border-[#dbe5f1] bg-white px-4 py-3 text-[13px] leading-6 text-[#24405f] shadow-[0_8px_20px_rgba(15,23,42,0.05)] whitespace-pre-wrap"
              >
                {message.content}
              </div>
            ) : (
              <div
                key={message.id}
                className="ml-8 rounded-[18px] rounded-tr-[8px] bg-[#1151ff] px-4 py-3 text-[13px] font-semibold leading-6 text-white shadow-[0_12px_24px_rgba(17,81,255,0.16)] whitespace-pre-wrap"
              >
                {message.imagePreviewUrl ? (
                  <img src={message.imagePreviewUrl} alt={message.imageName ?? 'dropped content'} className="mb-3 max-h-40 w-full rounded-[12px] bg-white/10 object-contain" />
                ) : null}
                {message.content}
              </div>
            ),
          )}
          {chatBusy ? (
            <div className="rounded-[18px] rounded-tl-[8px] border border-[#dbe5f1] bg-white px-4 py-3 text-[13px] font-semibold text-[#5f7390] shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              Mina가 첨부한 내용을 읽는 중입니다...
            </div>
          ) : null}
        </div>

        <div className="rounded-[20px] border border-[#d7e2f2] bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          {selectedExcerpt ? (
            <div className="mb-3 rounded-[16px] border border-[#dbe5f1] bg-[#f8fbff] px-3 py-3 text-[12px] leading-5 text-[#4f627f]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Text Attached</div>
                <button
                  type="button"
                  onClick={() => setSelectedExcerpt(null)}
                  className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890ad]"
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 line-clamp-4">{selectedExcerpt}</div>
            </div>
          ) : null}

          {droppedImage ? (
            <div className="mb-3 rounded-[16px] border border-[#dbe5f1] bg-[#f8fbff] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Content Attached</div>
                <button
                  type="button"
                  onClick={() => setDroppedImage(null)}
                  className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890ad]"
                >
                  Clear
                </button>
              </div>
              <img src={droppedImage.previewUrl} alt={droppedImage.name} className="mt-3 max-h-36 w-full rounded-[12px] bg-white object-contain" />
              <div className="mt-2 truncate text-[12px] font-semibold text-[#60718a]">{droppedImage.name}</div>
            </div>
          ) : null}

          {dragActive && !selectedExcerpt && !droppedImage ? (
            <div className="mb-3 rounded-[16px] border-2 border-dashed border-primary bg-[#eef4ff] px-3 py-4 text-center text-[12px] font-extrabold text-primary">
              Drop text or content here
            </div>
          ) : null}

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              void handleClipboardPaste(event.clipboardData);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="질문을 입력하세요"
            className="min-h-[88px] w-full resize-none border-0 bg-transparent text-[13px] leading-6 text-[#18314f] outline-none placeholder:text-[#90a0b8]"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold text-[#7b8da9]">
              Enter 전송
            </div>
            <button
              type="button"
              disabled={chatBusy || draft.trim().length === 0 || !activeChapter}
              onClick={() => void handleSend()}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#1151ff] px-4 py-2.5 text-[12px] font-extrabold tracking-[0.06em] text-white shadow-[0_12px_22px_rgba(17,81,255,0.16)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Icon name="help" className="h-4 w-4" />
              Send
            </button>
          </div>
          {chatError ? (
            <div className="mt-3 rounded-[16px] border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-[12px] font-semibold text-[#b42318]">
              {chatError}
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
