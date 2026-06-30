const SOLUTION_PATTERNS =
  /(?:उपाय|समाधान|क्या\s*करूं|क्या\s*करें|कैसे\s*ठीक|कैसे\s*सुधार|रास्ता|निवारण|तोड़|छुटकारा|solution|remedy|fix|kaise\s*theek)/i;

const PROBLEM_PATTERNS =
  /(?:समस्या|परेशान|दिक्कत|तकलीफ|रुकावट|तनाव|देरी|कैसा\s*रहेगा|क्या\s*होगा|बताओ|बताइए|career|money|shaadi|shadi|पैस|करियर|विवाह|जीवन)/i;

export type ConsultationIntent = "problem" | "solution" | "general";

export function detectConsultationIntent(text: string): ConsultationIntent {
  const trimmed = text.trim();
  if (!trimmed) return "general";

  if (SOLUTION_PATTERNS.test(trimmed)) return "solution";
  if (PROBLEM_PATTERNS.test(trimmed)) return "problem";

  return "general";
}
