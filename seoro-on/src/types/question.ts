export type QuestionMode = 'lifecycle' | 'nonnarrative' | 'event' | 'mixed';
export type QuestionColor = 'green' | 'yellow';

export type Question = {
  id: string;
  mode: QuestionMode;
  mode_ko: string;
  section_order: number;
  section: string;
  q_order: number;
  color: QuestionColor;
  question: string;
  created_at: string;
};
