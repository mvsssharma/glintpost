export interface FeedbackQuestion {
  id: string;
  text: string;
  type: "SELECT" | "NPS" | "TEXT";
  options?: string[];
  required: boolean;
}

export interface FeedbackAnswer {
  questionId: string;
  value: string | number;
}
