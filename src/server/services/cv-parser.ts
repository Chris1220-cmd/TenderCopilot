import { getFileBuffer } from '@/lib/s3';

// ─── Types ──────────────────────────────────────────────────

interface ParsedEducation {
  degree: string;
  institution: string;
  year: number | null;
}

interface ParsedExperience {
  projectName: string;
  client: string;
  role: string;
  budget: number | null;
  startYear: number;
  endYear: number | null;
  description: string | null;
  category: string | null;
}

interface ParsedCertification {
  name: string;
  issuer: string;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface ParsedCvData {
  fullName: string;
  title: string;
  totalExperience: number;
  education: ParsedEducation[];
  experience: ParsedExperience[];
  certifications: ParsedCertification[];
}

// ─── Prompt ─────────────────────────────────────────────────

const CV_PARSE_PROMPT = `Ανέλυσε αυτό το βιογραφικό και εξήγαγε δομημένα δεδομένα σε JSON.

ΚΑΝΟΝΕΣ:
- Εξήγαγε ΜΟΝΟ πληροφορίες που υπάρχουν στο κείμενο
- Αν κάτι δεν αναφέρεται, βάλε null
- Τα χρόνια εμπειρίας υπολόγισέ τα από τις θέσεις εργασίας/έργα
- Η εμπειρία πρέπει να είναι σε ΕΡΓΑ (projects), όχι θέσεις εργασίας
- Αν το CV αναφέρει θέσεις εργασίας αντί για έργα, μετέτρεψέ τες σε project entries
- Dates σε μορφή ISO string (YYYY-MM-DD) ή null

Επέστρεψε ΜΟΝΟ JSON χωρίς markdown formatting:
{
  "fullName": "string",
  "title": "string — ειδικότητα/τίτλος",
  "totalExperience": number,
  "education": [{ "degree": "string", "institution": "string", "year": number|null }],
  "experience": [{ "projectName": "string", "client": "string", "role": "string", "budget": number|null, "startYear": number, "endYear": number|null, "description": "string|null", "category": "string|null" }],
  "certifications": [{ "name": "string", "issuer": "string", "issueDate": "string|null", "expiryDate": "string|null" }]
}`;

// ─── Text Extraction ────────────────────────────────────────

async function extractText(fileKey: string): Promise<string> {
  const buffer = await getFileBuffer(fileKey);
  const ext = fileKey.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    if (!result.text || result.text.trim().length < 50) {
      throw new Error('NO_TEXT');
    }
    return result.text;
  }

  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value || result.value.trim().length < 50) {
      throw new Error('NO_TEXT');
    }
    return result.value;
  }

  throw new Error('UNSUPPORTED_FORMAT');
}

// ─── Parse CV ───────────────────────────────────────────────

export async function parseCv(fileKey: string): Promise<ParsedCvData> {
  const text = await extractText(fileKey);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('PARSE_FAILED');
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent([
    CV_PARSE_PROMPT,
    `--- ΒΙΟΓΡΑΦΙΚΟ ---\n${text.slice(0, 15000)}`,
  ]);

  const response = result.response.text();

  try {
    const parsed = JSON.parse(response) as ParsedCvData;
    return {
      fullName: parsed.fullName || '',
      title: parsed.title || '',
      totalExperience: parsed.totalExperience || 0,
      education: Array.isArray(parsed.education) ? parsed.education : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    };
  } catch {
    // Fallback: try to extract JSON from markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim()) as ParsedCvData;
        return {
          fullName: parsed.fullName || '',
          title: parsed.title || '',
          totalExperience: parsed.totalExperience || 0,
          education: Array.isArray(parsed.education) ? parsed.education : [],
          experience: Array.isArray(parsed.experience) ? parsed.experience : [],
          certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
        };
      } catch {
        throw new Error('PARSE_FAILED');
      }
    }
    throw new Error('PARSE_FAILED');
  }
}
