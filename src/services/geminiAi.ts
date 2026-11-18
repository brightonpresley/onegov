import { GoogleGenAI, Type } from '@google/genai';
import {
  extractMapsGroundingPlaces,
  extractSearchGroundingSources,
  type MapsGroundingPlace,
  type SearchGroundingSource,
} from '../lib/onegovRules.ts';

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function askOneGovAssistant(params: {
  message: string;
  role: string;
  language: string;
  servicesContext: string;
}): Promise<{ reply: string; suggestedServiceCodes: string[] }> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `User Role: ${params.role}\nPreferred Language: ${params.language}\nAvailable OneGov Services:\n${params.servicesContext}\n\nUser Question: ${params.message}`,
    config: {
      systemInstruction:
        'You are OneGov Intelligence, Zambia’s digital government & SME compliance assistant. Provide accurate, plain-language guidance based on the provided OneGov service catalog. Never claim to issue legal approvals or live government decisions yourself; clarify that participating institutions (ZRA, RTSA, PACRA, Councils, ZESCO) remain the official decision authorities. Keep answers concise, practical for SMEs and citizens, and cite exact service codes when relevant.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Clear, helpful response in the requested language/context.',
          },
          suggestedServiceCodes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Matching service codes from the catalog if applicable.',
          },
        },
        required: ['reply', 'suggestedServiceCodes'],
      },
    },
  });

  const raw = (response.text ?? '{}').trim();
  const parsed = JSON.parse(raw) as { reply?: string; suggestedServiceCodes?: string[] };
  return {
    reply: parsed.reply || 'I can help guide you through OneGov services and requirements.',
    suggestedServiceCodes: parsed.suggestedServiceCodes || [],
  };
}

export async function analyzeDocumentOcr(params: {
  fileName: string;
  documentTextOrSummary: string;
  requiredDocs: string[];
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<{
  detectedDocType: string;
  extractedFields: Array<{ key: string; value: string }>;
  completenessScore: number;
  missingItems: string[];
  validationNotes: string;
}> {
  const ai = getGeminiClient();
  const textPrompt = `Analyse this uploaded government application document for OneGov Zambia.
File Name: ${params.fileName}
Required Documents Checklist: ${params.requiredDocs.join(', ')}
Document Text / Metadata: ${params.documentTextOrSummary}

Classify the document, extract key identifiers (e.g., NRC, TPIN, PACRA Number, Plot Number, Plate Number, Expiry Date), estimate completeness score (0-100), and identify missing documents or validation issues.`;

  const contents =
    params.imageBase64 && params.imageMimeType
      ? {
          parts: [
            {
              inlineData: {
                mimeType: params.imageMimeType,
                data: params.imageBase64,
              },
            },
            { text: textPrompt },
          ],
        }
      : textPrompt;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction:
        'You are the OneGov AI Document Intelligence engine. Extract factual fields only. Never fabricate official government stamps. Return structured JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedDocType: { type: Type.STRING },
          extractedFields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                value: { type: Type.STRING },
              },
              required: ['key', 'value'],
            },
          },
          completenessScore: { type: Type.INTEGER },
          missingItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          validationNotes: { type: Type.STRING },
        },
        required: [
          'detectedDocType',
          'extractedFields',
          'completenessScore',
          'missingItems',
          'validationNotes',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    detectedDocType: parsed.detectedDocType || 'Supporting Document',
    extractedFields: Array.isArray(parsed.extractedFields) ? parsed.extractedFields : [],
    completenessScore: typeof parsed.completenessScore === 'number' ? parsed.completenessScore : 85,
    missingItems: Array.isArray(parsed.missingItems) ? parsed.missingItems : [],
    validationNotes: parsed.validationNotes || 'Document parsed for officer verification.',
  };
}

export async function analyzeCouncilRevenueZone(params: {
  zoneName: string;
  councilName: string;
  province: string;
  expectedRevenueZmw: number;
  actualRevenueZmw: number;
  registeredBusinesses: number;
  activePermits: number;
  unpaidProperties: number;
  indicators: string[];
}): Promise<{
  confirmedFindings: string[];
  possibleExplanations: string[];
  areasForFurtherInvestigation: string[];
  recommendedOfficerActions: string[];
}> {
  const ai = getGeminiClient();
  const perfPct = Math.round((params.actualRevenueZmw / Math.max(1, params.expectedRevenueZmw)) * 100);
  const prompt = `Analyse this Zambian local council revenue zone using ONLY verified operational data provided below.
Zone: ${params.zoneName} (${params.councilName}, ${params.province} Province)
Expected Revenue: K${params.expectedRevenueZmw}
Actual Verified Revenue: K${params.actualRevenueZmw} (${perfPct}% performance)
Registered Businesses: ${params.registeredBusinesses}
Active 2026 Permits: ${params.activePermits}
Unpaid Property Rate Accounts: ${params.unpaidProperties}
Verified Operational Indicators:
- ${params.indicators.join('\n- ')}

CRITICAL RULE: Do NOT present assumptions as established facts. Strictly separate:
1. confirmedFindings (directly supported by the numbers/indicators above)
2. possibleExplanations (hypotheses that could explain the shortfall)
3. areasForFurtherInvestigation (concrete checks for council officers)
4. recommendedOfficerActions (practical next steps for the council team).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are OneGov Council Revenue Intelligence. Be precise, objective, and distinguish verified facts from hypotheses.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confirmedFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
          possibleExplanations: { type: Type.ARRAY, items: { type: Type.STRING } },
          areasForFurtherInvestigation: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedOfficerActions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'confirmedFindings',
          'possibleExplanations',
          'areasForFurtherInvestigation',
          'recommendedOfficerActions',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    confirmedFindings: parsed.confirmedFindings || [],
    possibleExplanations: parsed.possibleExplanations || [],
    areasForFurtherInvestigation: parsed.areasForFurtherInvestigation || [],
    recommendedOfficerActions: parsed.recommendedOfficerActions || [],
  };
}

export async function analyzeIpSimilarity(params: {
  ipType: 'patent' | 'trademark';
  title: string;
  description: string;
  classification: string;
  existingRecords: Array<{ reference: string; title: string; description: string; classification: string }>;
}): Promise<{
  overallComparisonSummary: string;
  matches: Array<{
    reference: string;
    title: string;
    similarityPct: number;
    overlapNotes: string;
  }>;
  disclaimer: string;
}> {
  const ai = getGeminiClient();
  const recordsText = params.existingRecords
    .map((r) => `[${r.reference}] ${r.title} (${r.classification}): ${r.description}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `IP Type: ${params.ipType}\nProposed Title/Mark: ${params.title}\nClassification: ${params.classification}\nDescription: ${params.description}\n\nDemo PACRA & Public Prior-Art Records:\n${recordsText}\n\nCompare technical concepts or brand elements and produce a preliminary similarity report.`,
    config: {
      systemInstruction:
        'You are the OneGov PACRA Intellectual Property Preliminary Screening Assistant. Highlight technical or trademark overlaps clearly. Always include the statutory disclaimer that AI similarity checking is NOT a legal determination of novelty, patentability, or infringement.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallComparisonSummary: { type: Type.STRING },
          matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                reference: { type: Type.STRING },
                title: { type: Type.STRING },
                similarityPct: { type: Type.INTEGER },
                overlapNotes: { type: Type.STRING },
              },
              required: ['reference', 'title', 'similarityPct', 'overlapNotes'],
            },
          },
          disclaimer: { type: Type.STRING },
        },
        required: ['overallComparisonSummary', 'matches', 'disclaimer'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    overallComparisonSummary:
      parsed.overallComparisonSummary || 'Preliminary comparison completed against demo PACRA records.',
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    disclaimer:
      parsed.disclaimer ||
      'Preliminary AI similarity analysis is informational only and is NOT a legal determination of novelty, patentability, or infringement. PACRA remains the official statutory authority.',
  };
}

export async function generatePredictiveInsights(params: {
  revenueSummary: string;
  fraudAlertsSummary: string;
}): Promise<{
  demandForecast: string;
  revenueOutlook: string;
  leakageRisks: string[];
}> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Revenue Summary:\n${params.revenueSummary}\n\nFlagged Anomalies:\n${params.fraudAlertsSummary}\n\nProvide workload demand forecast, revenue outlook, and priority leakage risks for human review.`,
    config: {
      systemInstruction:
        'You are OneGov Predictive Intelligence for ZRA and institutional planners. Base insights strictly on provided metrics.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          demandForecast: { type: Type.STRING },
          revenueOutlook: { type: Type.STRING },
          leakageRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['demandForecast', 'revenueOutlook', 'leakageRisks'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    demandForecast: parsed.demandForecast || '',
    revenueOutlook: parsed.revenueOutlook || '',
    leakageRisks: Array.isArray(parsed.leakageRisks) ? parsed.leakageRisks : [],
  };
}

export async function askWithSearchGrounding(params: {
  query: string;
  role: string;
  language: string;
}): Promise<{
  reply: string;
  sources: SearchGroundingSource[];
}> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `User Role: ${params.role}\nPreferred Language: ${params.language}\nQuestion about Zambian public services, tax rules, municipal permits, or IP policy:\n${params.query}`,
    config: {
      systemInstruction:
        'You are OneGov Intelligence. Use Google Search grounding to answer questions about Zambian statutory agencies (ZRA, RTSA, PACRA, ZESCO, City Councils) accurately. Keep responses clear, practical, and cite verified official details. Clarify that participating agencies remain the official decision authorities.',
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  return {
    reply: (response.text || 'No grounded search summary returned.').trim(),
    sources: extractSearchGroundingSources(chunks),
  };
}

export async function findCivicLocationsWithMapsGrounding(params: {
  query: string;
  latitude?: number;
  longitude?: number;
}): Promise<{
  reply: string;
  places: MapsGroundingPlace[];
}> {
  const ai = getGeminiClient();
  const latitude =
    typeof params.latitude === 'number' && Number.isFinite(params.latitude) ? params.latitude : -15.4167;
  const longitude =
    typeof params.longitude === 'number' && Number.isFinite(params.longitude) ? params.longitude : 28.2833;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: params.query,
    config: {
      systemInstruction:
        'You are OneGov Civic Locator for Zambia. Help citizens and SMEs find nearby Zambian government service stations (RTSA, ZRA, PACRA, ZESCO, City Council offices) using Google Maps grounding. Format the response cleanly in Markdown.',
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude,
            longitude,
          },
        },
      },
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  return {
    reply: (response.text || 'No grounded civic locations found for that area.').trim(),
    places: extractMapsGroundingPlaces(chunks),
  };
}

export async function transcribeAudioBase64(params: {
  audioBase64: string;
  mimeType: string;
}): Promise<{ transcript: string }> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType || 'audio/webm',
            data: params.audioBase64,
          },
        },
        { text: 'Transcribe this audio accurately.' },
      ],
    },
  });

  return {
    transcript: (response.text || '').trim(),
  };
}

