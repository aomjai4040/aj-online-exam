export interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  timeLimit: number; // minutes, 0 = no limit
  questionCount: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  order: number;
  text: string;
  options: [string, string, string, string];
  correctAnswer: number; // 0–3
  explanation: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  studentName: string;
  answers: number[]; // index = question order, value = chosen option (0–3), -1 = skipped
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number; // seconds
  submittedAt: Date;
}

export interface QuestionForm {
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation: string;
}

export interface ExamForm {
  title: string;
  description: string;
  subject: string;
  timeLimit: number;
  isPublished: boolean;
  questions: QuestionForm[];
}
