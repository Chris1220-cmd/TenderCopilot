import { db } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────

export interface Suggestion {
  requirementId: string;
  memberId: string;
  memberName: string;
  score: number;
  reasoning: string;
}

// ─── Prompt ──────────────────────────────────────────────────

function buildPrompt(
  requirements: Array<{
    id: string;
    role: string;
    qualifications: string | null;
    minExperience: number | null;
  }>,
  members: Array<{
    id: string;
    fullName: string;
    title: string;
    totalExperience: number;
    education: Array<{ degree: string; institution: string }>;
    experience: Array<{ role: string; category: string | null; description: string | null }>;
    certifications: Array<{ name: string }>;
  }>
): string {
  return `Είσαι ειδικός σε θέματα ανθρώπινου δυναμικού για διαγωνισμούς (tenders). Αντιστοίχισε κάθε απαίτηση θέσης με το πλέον κατάλληλο μέλος ομάδας.

ΑΠΑΙΤΗΣΕΙΣ ΘΕΣΕΩΝ:
${JSON.stringify(requirements, null, 2)}

ΔΙΑΘΕΣΙΜΑ ΜΕΛΗ ΟΜΑΔΑΣ:
${JSON.stringify(members, null, 2)}

ΚΑΝΟΝΕΣ:
- Κάθε απαίτηση θέσης πρέπει να αντιστοιχιστεί με ΑΚΡΙΒΩΣ ΕΝΑ μέλος ομάδας
- Το ίδιο μέλος μπορεί να αντιστοιχιστεί σε πολλές θέσεις αν είναι η καλύτερη επιλογή
- Score: 0-100 (100 = τέλεια αντιστοίχηση)
- Βασίσου στα προσόντα, εμπειρία, πιστοποιήσεις και ρόλους
- Η αιτιολόγηση να είναι σύντομη (1-2 προτάσεις) στα Ελληνικά

Επέστρεψε ΜΟΝΟ JSON (χωρίς markdown):
[
  {
    "requirementId": "string — το id της απαίτησης",
    "memberId": "string — το id του μέλους",
    "memberName": "string — το ονοματεπώνυμο του μέλους",
    "score": number,
    "reasoning": "string — σύντομη αιτιολόγηση στα Ελληνικά"
  }
]`;
}

// ─── Main Function ────────────────────────────────────────────

export async function suggestAssignments(
  tenderId: string,
  tenantId: string
): Promise<Suggestion[]> {
  // Fetch requirements for this tender
  const requirements = await db.teamRequirement.findMany({
    where: { tenderId },
    select: {
      id: true,
      role: true,
      qualifications: true,
      minExperience: true,
    },
  });

  if (requirements.length === 0) return [];

  // Fetch active team members with full profile
  const members = await db.teamMember.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      fullName: true,
      title: true,
      totalExperience: true,
      education: {
        select: { degree: true, institution: true },
        orderBy: { year: 'desc' },
        take: 3,
      },
      experience: {
        select: { role: true, category: true, description: true },
        orderBy: { startYear: 'desc' },
        take: 5,
      },
      certifications: {
        select: { name: true },
        take: 5,
      },
    },
  });

  if (members.length === 0) return [];

  // Build valid ID sets for validation
  const validRequirementIds = new Set(requirements.map((r) => r.id));
  const validMemberIds = new Set(members.map((m) => m.id));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildPrompt(requirements, members);
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let parsed: Suggestion[];
  try {
    parsed = JSON.parse(responseText) as Suggestion[];
  } catch {
    // Try to extract from markdown code block
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim()) as Suggestion[];
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  // Validate IDs exist before returning
  return parsed.filter(
    (s) =>
      s &&
      typeof s.requirementId === 'string' &&
      typeof s.memberId === 'string' &&
      typeof s.memberName === 'string' &&
      typeof s.score === 'number' &&
      typeof s.reasoning === 'string' &&
      validRequirementIds.has(s.requirementId) &&
      validMemberIds.has(s.memberId)
  );
}
