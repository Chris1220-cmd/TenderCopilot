export const CV_TEMPLATES = {
  europass: { id: 'europass', labelKey: 'teamMembers.templateEuropass' },
  greekPublic: { id: 'greekPublic', labelKey: 'teamMembers.templateGreekPublic' },
  summary: { id: 'summary', labelKey: 'teamMembers.templateSummary' },
} as const;

export type CvTemplateId = keyof typeof CV_TEMPLATES;
