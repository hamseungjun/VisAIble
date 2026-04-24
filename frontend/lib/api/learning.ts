import { apiClient, buildApiUrl } from '@/lib/api/client';

export type LearningChapterSummary = {
  id: string;
  title: string;
  summary: string;
  sourceLabel: string;
  sourceUrl: string;
  chapterLabel: string;
};

export type LearningChapterContent = LearningChapterSummary & {
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
};

export async function listLearningChapters() {
  return apiClient<LearningChapterSummary[]>('/learning/chapters');
}

export async function getLearningChapter(chapterId: string) {
  return apiClient<LearningChapterContent>(`/learning/chapters/${chapterId}`);
}

export function getLearningChapterPdfUrl(chapterId: string) {
  return buildApiUrl(`/learning/chapters/${chapterId}/pdf`);
}

export async function chatWithLearning(payload: {
  question: string;
  chapterId: string;
  chapterTitle: string;
  sourceLabel: string;
  sourceUrl: string;
  lectureContext: string;
  selectedExcerpt?: string | null;
  selectedImageBase64?: string | null;
  selectedImageMimeType?: string | null;
}) {
  return apiClient<{ answer: string }>('/learning/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
