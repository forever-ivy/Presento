import { z } from "zod";

const looseRecordSchema = z.record(z.string(), z.unknown());

export const skillChunkSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  source: z.string().optional(),
  metadata: looseRecordSchema.optional(),
});

export const retrievedSourceSchema = z.object({
  id: z.string(),
  source: z.string(),
  fileName: z.string().optional(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
  codePath: z.string().optional(),
  page: z.number().optional(),
  slide: z.number().optional(),
});

export const projectBriefInputSchema = z.object({
  chunks: z.array(skillChunkSchema).default([]),
});

export const projectBriefOutputSchema = z.object({
  projectName: z.string(),
  oneSentence: z.string(),
  cards: z.array(z.object({
    title: z.string(),
    items: z.array(z.string()),
  })),
  citations: z.array(z.object({
    source: z.string(),
    fileName: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
  })),
  generatedAt: z.string(),
});

export const slideAssistantActionSchema = z.enum([
  "overview",
  "short",
  "conversational",
  "contribution",
  "transition",
  "teacher_question",
  "answer_card",
  "keywords",
  "rewrite",
  "rewrite_draft",
  "drill_answer",
]);

export const slideScriptInputSchema = z.object({
  slideId: z.string().optional(),
  slideTitle: z.string().default("当前页"),
  slideIndex: z.number().default(1),
  fileId: z.string().optional(),
  extractedText: z.string().optional(),
  selectedText: z.string().optional(),
  currentDraft: z.string().optional(),
  instruction: z.string().optional(),
  messages: z.array(looseRecordSchema).default([]),
  action: slideAssistantActionSchema.default("overview"),
  chunks: z.array(skillChunkSchema).default([]),
});

export const slideScriptOutputSchema = z.object({
  projectName: z.string(),
  slideTitle: z.string(),
  task: z.string(),
  normal: z.string(),
  short: z.string(),
  conversational: z.string(),
  contribution: z.string(),
  transition: z.string(),
  answerCard: z.string(),
  keywords: z.array(z.string()),
  risks: z.array(z.string()),
  basis: z.object({
    topics: z.array(z.string()),
    materials: z.array(z.string()),
  }),
  rewrite: z.string().optional(),
  drillAnswer: z.string().optional(),
  suggestedQuestions: z.array(z.string()).optional(),
  generatedAt: z.string().optional(),
});

export const riskQuestionsInputSchema = z.object({
  chunks: z.array(skillChunkSchema).default([]),
});

export const riskQuestionsOutputSchema = z.object({
  projectName: z.string(),
  questions: z.array(z.string()),
});

export const defenseTurnInputSchema = z.object({
  slideId: z.string().optional(),
  slideTitle: z.string().default("当前页"),
  slideIndex: z.number().default(1),
  knowledgeNodeId: z.string().optional(),
  teacherRole: z.string().default("strict"),
  memberScope: z.string().optional(),
  userAnswer: z.string().default(""),
  currentSlideId: z.string().optional(),
  currentKnowledgeNodeId: z.string().optional(),
  previousTurns: z.array(z.object({
    aiMessage: z.string(),
    userAnswer: z.string(),
    score: z.number().nullable().optional(),
  })).default([]),
  sessionState: looseRecordSchema.optional(),
  retrievedSources: z.array(looseRecordSchema).default([]),
  chunks: z.array(skillChunkSchema).default([]),
});

export const defenseTurnOutputSchema = z.object({
  role: z.literal("AI 老师"),
  message: z.string(),
  feedback: z.object({
    score: z.number(),
    strengths: z.array(z.string()),
    risks: z.array(z.string()),
    improvedAnswer: z.string(),
  }),
  followUps: z.array(z.string()),
  citations: z.array(z.object({
    source: z.string(),
    fileName: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
  })),
  generatedAt: z.string(),
  speech: z.union([looseRecordSchema, z.null()]).optional(),
});

export const reviewReportInputSchema = z.object({
  turns: z.array(looseRecordSchema).default([]),
  sessionState: looseRecordSchema.optional(),
});

export const reviewReportOutputSchema = z.object({
  projectName: z.string(),
  totalTurns: z.number(),
  averageScore: z.number(),
  scoreLabel: z.string(),
  clarityScore: z.number(),
  evidenceScore: z.number(),
  pressureScore: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.object({
    title: z.string(),
    count: z.number(),
    evidence: z.string(),
  })),
  betterAnswers: z.array(z.object({
    title: z.string(),
    answer: z.string(),
    slideTitle: z.string(),
  })),
  nextActions: z.array(z.string()),
  recommendedSkills: z.array(z.string()),
  citations: z.array(z.object({
    source: z.string(),
    fileName: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
  })),
  generatedAt: z.string(),
});

export const weaknessDeepDiveInputSchema = z.object({
  title: z.string().default("待补强问题"),
  chunks: z.array(skillChunkSchema).default([]),
});

export const weaknessDeepDiveOutputSchema = z.object({
  projectName: z.string(),
  title: z.string(),
  explanation: z.string(),
  checklist: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const contentRepurposeInputSchema = z.object({
  summary: z.string().default(""),
});

export const contentRepurposeOutputSchema = z.object({
  projectName: z.string(),
  qqSpaceSummary: z.string(),
  weishiScript: z.string(),
  tencentVideoScript: z.string(),
});

export const explanationInputSchema = z.object({
  title: z.string().default("当前资料"),
  question: z.string().optional(),
  fileId: z.string().optional(),
  nodeId: z.string().optional(),
  chunks: z.array(skillChunkSchema).default([]),
});

export const explanationOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()),
  citations: z.array(z.object({
    source: z.string(),
    fileName: z.string().optional(),
    lineStart: z.number().optional(),
    lineEnd: z.number().optional(),
    codePath: z.string().optional(),
    page: z.number().optional(),
    slide: z.number().optional(),
  })),
  followUps: z.array(z.string()).default([]),
});

export const fallbackAnswerInputSchema = z.object({
  question: z.string().default(""),
  reason: z.string().optional(),
  chunks: z.array(skillChunkSchema).default([]),
});

export const fallbackAnswerOutputSchema = z.object({
  answer: z.string(),
  nextStep: z.string(),
  citations: z.array(z.object({
    source: z.string(),
    fileName: z.string().optional(),
    lineStart: z.number().optional(),
    lineEnd: z.number().optional(),
  })),
});

export const rubricScoringInputSchema = defenseTurnInputSchema;

export const rubricScoringOutputSchema = z.object({
  overallScore: z.number(),
  dimensions: z.array(z.object({
    name: z.string(),
    score: z.number(),
    comment: z.string(),
  })),
  summary: z.string(),
});

export const memberScopeDefenseInputSchema = defenseTurnInputSchema;

export const memberScopeDefenseOutputSchema = z.object({
  scopeStatement: z.string(),
  scopeClarityScore: z.number(),
  risks: z.array(z.string()),
  followUp: z.string(),
});

export const evidenceGapCheckInputSchema = defenseTurnInputSchema;

export const evidenceGapCheckOutputSchema = z.object({
  summary: z.string(),
  gaps: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  citations: z.array(z.object({
    source: z.string(),
    fileName: z.string().optional(),
    lineStart: z.number().optional(),
    lineEnd: z.number().optional(),
  })),
});

export const skillSchemaByName = {
  ProjectBriefInput: projectBriefInputSchema,
  ProjectBriefOutput: projectBriefOutputSchema,
  SlideScriptInput: slideScriptInputSchema,
  SlideScriptOutput: slideScriptOutputSchema,
  RiskQuestionsInput: riskQuestionsInputSchema,
  RiskQuestionsOutput: riskQuestionsOutputSchema,
  DefenseTurnInput: defenseTurnInputSchema,
  DefenseTurnOutput: defenseTurnOutputSchema,
  ReviewReportInput: reviewReportInputSchema,
  ReviewReportOutput: reviewReportOutputSchema,
  WeaknessDeepDiveInput: weaknessDeepDiveInputSchema,
  WeaknessDeepDiveOutput: weaknessDeepDiveOutputSchema,
  ContentRepurposeInput: contentRepurposeInputSchema,
  ContentRepurposeOutput: contentRepurposeOutputSchema,
  ExplanationInput: explanationInputSchema,
  ExplanationOutput: explanationOutputSchema,
  FallbackAnswerInput: fallbackAnswerInputSchema,
  FallbackAnswerOutput: fallbackAnswerOutputSchema,
  RubricScoringInput: rubricScoringInputSchema,
  RubricScoringOutput: rubricScoringOutputSchema,
  MemberScopeDefenseInput: memberScopeDefenseInputSchema,
  MemberScopeDefenseOutput: memberScopeDefenseOutputSchema,
  EvidenceGapCheckInput: evidenceGapCheckInputSchema,
  EvidenceGapCheckOutput: evidenceGapCheckOutputSchema,
};

export type SkillSchemaName = keyof typeof skillSchemaByName;

export function getSkillSchema<Name extends SkillSchemaName>(schemaName: Name): (typeof skillSchemaByName)[Name] {
  return skillSchemaByName[schemaName];
}
