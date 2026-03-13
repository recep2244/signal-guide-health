/**
 * WhatsApp Pilot Follow-up Service
 * Minimal production-oriented pilot for automated daily follow-ups.
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { localLlmService } from './localLlmService';

const FLOW_ID = 'daily_followup_v1';

type FollowUpStep = 'wellbeing' | 'symptoms' | 'medications' | 'completed';

type Triage = 'red' | 'amber' | 'green';

interface FollowUpState {
  step: FollowUpStep;
  wellbeingScore?: number;
  symptomsReported?: boolean;
  medicationsTaken?: boolean;
  startedAt: string;
  completedAt?: string;
}

interface PilotPatient {
  id: string;
  whatsappPhone: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface IncomingMessage {
  id: string;
  from: string;
  text: string;
}

interface MessageStatusUpdate {
  id: string;
  status: string;
}

interface FollowUpBatchResult {
  attempted: number;
  sent: number;
  errors: Array<{ patientId: string; error: string }>;
}

interface WearableContextSnapshot {
  generatedAt: string;
  lookbackHours: number;
  lastSyncAt: string | null;
  latest: {
    avgHeartRate: number | null;
    restingHeartRate: number | null;
    bloodOxygenPercent: number | null;
    hrvMs: number | null;
    sleepHours: number | null;
    steps: number | null;
  };
  riskHints: string[];
}

interface TriageDecision {
  final: Triage;
  source: 'rule_only' | 'llm_confident' | 'risk_flags' | 'wearable_signals';
  reasons: string[];
}

const safeTimingCompare = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
};

const normalizePhone = (value: string): string => {
  const trimmed = value.trim();
  const stripped = trimmed.replace(/[^\d+]/g, '');

  if (stripped.startsWith('+')) {
    return stripped;
  }

  if (stripped.startsWith('00')) {
    return `+${stripped.slice(2)}`;
  }

  return `+${stripped}`;
};

const phoneLookupCandidates = (phoneNumber: string): string[] => {
  const normalized = normalizePhone(phoneNumber);
  const digits = normalized.replace(/[^\d]/g, '');
  const variants = new Set<string>([
    normalized,
    digits,
    `+${digits}`,
  ]);

  if (digits.startsWith('00')) {
    variants.add(`+${digits.slice(2)}`);
  } else {
    variants.add(`00${digits}`);
  }

  return Array.from(variants).filter((value) => value.length > 3);
};

const parseFlowState = (state: unknown): FollowUpState => {
  const fallback: FollowUpState = {
    step: 'wellbeing',
    startedAt: new Date().toISOString(),
  };

  if (!state || typeof state !== 'object') {
    return fallback;
  }

  const obj = state as Record<string, unknown>;
  const step = obj['step'];

  return {
    step:
      step === 'wellbeing' ||
      step === 'symptoms' ||
      step === 'medications' ||
      step === 'completed'
        ? step
        : 'wellbeing',
    wellbeingScore:
      typeof obj['wellbeingScore'] === 'number' ? obj['wellbeingScore'] : undefined,
    symptomsReported:
      typeof obj['symptomsReported'] === 'boolean' ? obj['symptomsReported'] : undefined,
    medicationsTaken:
      typeof obj['medicationsTaken'] === 'boolean' ? obj['medicationsTaken'] : undefined,
    startedAt:
      typeof obj['startedAt'] === 'string' ? obj['startedAt'] : fallback.startedAt,
    completedAt:
      typeof obj['completedAt'] === 'string' ? obj['completedAt'] : undefined,
  };
};

const parseWellbeingScore = (text: string): number | null => {
  const normalized = text.trim().toLowerCase();

  const numericMatch = normalized.match(/\b(10|[0-9])\b/);
  if (numericMatch) {
    const value = Number(numericMatch[1]);
    if (value >= 0 && value <= 10) {
      return value;
    }
  }

  if (/great|very well|excellent/.test(normalized)) {
    return 9;
  }
  if (/good|fine|ok|okay/.test(normalized)) {
    return 7;
  }
  if (/tired|not great|struggling|bad|poor/.test(normalized)) {
    return 3;
  }

  return null;
};

const parseYesNo = (text: string): boolean | null => {
  const normalized = text.trim().toLowerCase();

  if (/^(yes|y|1|true)\b/.test(normalized)) {
    return true;
  }

  if (/^(no|n|0|false)\b/.test(normalized)) {
    return false;
  }

  return null;
};

const triageFromState = (state: FollowUpState): Triage => {
  if ((state.wellbeingScore ?? 10) <= 3) {
    return 'red';
  }

  if (state.symptomsReported) {
    return 'amber';
  }

  if ((state.wellbeingScore ?? 10) <= 6 || state.medicationsTaken === false) {
    return 'amber';
  }

  return 'green';
};

const triageWeight: Record<Triage, number> = {
  green: 0,
  amber: 1,
  red: 2,
};

const escalateTriage = (ruleTriage: Triage, aiTriage: Triage | null): Triage => {
  if (!aiTriage) return ruleTriage;
  return triageWeight[aiTriage] > triageWeight[ruleTriage] ? aiTriage : ruleTriage;
};

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === 'object' && typeof (value as Prisma.Decimal).toNumber === 'function') {
    return (value as Prisma.Decimal).toNumber();
  }

  return null;
};

const HIGH_RISK_TERMS = [
  'chest pain',
  'faint',
  'fainting',
  'syncope',
  'severe breath',
  'shortness of breath at rest',
  'low oxygen',
  'hypoxia',
  'confusion',
  'palpitation severe',
];

const MODERATE_RISK_TERMS = [
  'dizziness',
  'breathless',
  'missed medication',
  'medication not taken',
  'tachycardia',
  'fatigue worsening',
  'edema',
  'swelling',
];

const normalizeFlags = (flags: string[]): string[] => {
  return flags
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const containsAnyTerm = (flags: string[], terms: string[]): boolean => {
  const joined = flags.join(' | ').toLowerCase();
  return terms.some((term) => joined.includes(term));
};

const hasCriticalWearableSignal = (ctx: WearableContextSnapshot): boolean => {
  return Boolean(
    (typeof ctx.latest.bloodOxygenPercent === 'number' && ctx.latest.bloodOxygenPercent <= 90) ||
      (typeof ctx.latest.restingHeartRate === 'number' && ctx.latest.restingHeartRate >= 125) ||
      (typeof ctx.latest.avgHeartRate === 'number' && ctx.latest.avgHeartRate >= 135) ||
      (typeof ctx.latest.hrvMs === 'number' && ctx.latest.hrvMs <= 15)
  );
};

const hasModerateWearableSignal = (ctx: WearableContextSnapshot): boolean => {
  return Boolean(
    (typeof ctx.latest.bloodOxygenPercent === 'number' && ctx.latest.bloodOxygenPercent <= 93) ||
      (typeof ctx.latest.restingHeartRate === 'number' && ctx.latest.restingHeartRate >= 110) ||
      (typeof ctx.latest.avgHeartRate === 'number' && ctx.latest.avgHeartRate >= 120) ||
      (typeof ctx.latest.sleepHours === 'number' && ctx.latest.sleepHours < 4.5)
  );
};

const resolveFinalTriage = (args: {
  ruleTriage: Triage;
  llmTriage: Triage | null;
  llmConfidence: number | null;
  riskFlags: string[];
  wearableContext: WearableContextSnapshot;
}): TriageDecision => {
  const reasons = [`rule:${args.ruleTriage}`];
  let final = args.ruleTriage;
  let source: TriageDecision['source'] = 'rule_only';

  if (
    args.llmTriage &&
    args.llmConfidence !== null &&
    args.llmConfidence >= 0.55
  ) {
    const merged = escalateTriage(final, args.llmTriage);
    if (merged !== final) {
      final = merged;
      source = 'llm_confident';
      reasons.push(`llm:${args.llmTriage}@${args.llmConfidence.toFixed(2)}`);
    }
  }

  const normalizedFlags = normalizeFlags(args.riskFlags);
  const highRiskByFlags = containsAnyTerm(normalizedFlags, HIGH_RISK_TERMS);
  const moderateRiskByFlags = containsAnyTerm(normalizedFlags, MODERATE_RISK_TERMS);
  const criticalWearable = hasCriticalWearableSignal(args.wearableContext);
  const moderateWearable = hasModerateWearableSignal(args.wearableContext);

  if (highRiskByFlags || criticalWearable) {
    final = 'red';
    source = highRiskByFlags ? 'risk_flags' : 'wearable_signals';
    if (highRiskByFlags) reasons.push('risk_flags:critical');
    if (criticalWearable) reasons.push('wearables:critical');
  } else if (final === 'green' && (moderateRiskByFlags || moderateWearable)) {
    final = 'amber';
    source = moderateRiskByFlags ? 'risk_flags' : 'wearable_signals';
    if (moderateRiskByFlags) reasons.push('risk_flags:moderate');
    if (moderateWearable) reasons.push('wearables:moderate');
  }

  return { final, source, reasons };
};

export class WhatsAppPilotService {
  verifyWebhookSignature(signature: string, payload: string): boolean {
    const secret = env.WHATSAPP_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return false;
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    return safeTimingCompare(signature, expectedSignature);
  }

  async processWebhook(payload: unknown): Promise<{ processed: number; unknownPhone: number }> {
    const incoming = this.extractIncomingMessages(payload);
    const statuses = this.extractStatuses(payload);

    let processed = 0;
    let unknownPhone = 0;

    for (const status of statuses) {
      await prisma.chatMessage.updateMany({
        where: { whatsappMessageId: status.id },
        data: { whatsappStatus: status.status },
      });
    }

    for (const message of incoming) {
      const found = await this.processIncomingMessage(message);
      if (found) {
        processed += 1;
      } else {
        unknownPhone += 1;
      }
    }

    return { processed, unknownPhone };
  }

  async startFollowUpForPatient(patientId: string): Promise<{ conversationId: string; sent: boolean }> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!patient || !patient.whatsappPhone || !patient.whatsappOptedIn) {
      throw new Error('Patient is not eligible for WhatsApp pilot follow-up');
    }

    const pilotPatient: PilotPatient = {
      id: patient.id,
      whatsappPhone: patient.whatsappPhone,
      user: {
        firstName: patient.user.firstName,
        lastName: patient.user.lastName,
      },
    };

    const conversation = await this.getOrCreateConversation(pilotPatient.id);

    const state: FollowUpState = {
      step: 'wellbeing',
      startedAt: new Date().toISOString(),
    };

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'active',
        currentFlow: FLOW_ID,
        flowState: state as unknown as Prisma.InputJsonValue,
        lastMessageAt: new Date(),
      },
    });

    const outboundText = this.buildWellbeingPrompt(pilotPatient.user.firstName);
    const messageId = await this.sendTextMessage(
      normalizePhone(pilotPatient.whatsappPhone),
      outboundText
    );

    await this.recordChatMessage({
      patientId: pilotPatient.id,
      direction: 'outbound',
      senderType: 'system',
      content: outboundText,
      flowStep: state.step,
      whatsappMessageId: messageId,
      whatsappStatus: messageId ? 'sent' : 'failed',
      metadata: {
        pilot: true,
        flowId: FLOW_ID,
      },
    });

    return {
      conversationId: conversation.id,
      sent: Boolean(messageId),
    };
  }

  async startFollowUpBatch(limit = 25): Promise<FollowUpBatchResult> {
    // Start of today in UTC (midnight UTC)
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const patients = await prisma.patient.findMany({
      where: {
        whatsappOptedIn: true,
        whatsappPhone: {
          not: null,
        },
        // Exclude patients who already received a follow-up today:
        // lastCheckIn is null (never checked in) OR lastCheckIn is before today UTC
        OR: [
          { lastCheckIn: null },
          { lastCheckIn: { lt: startOfTodayUtc } },
        ],
      },
      select: {
        id: true,
      },
      take: limit,
      orderBy: {
        lastCheckIn: { sort: 'asc', nulls: 'first' },
      },
    });

    const result: FollowUpBatchResult = {
      attempted: patients.length,
      sent: 0,
      errors: [],
    };

    for (const patient of patients) {
      try {
        const response = await this.startFollowUpForPatient(patient.id);
        if (response.sent) {
          result.sent += 1;
        }
      } catch (error) {
        result.errors.push({
          patientId: patient.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  private async processIncomingMessage(message: IncomingMessage): Promise<boolean> {
    const alreadyProcessed = await this.hasProcessedInboundMessage(message.id);
    if (alreadyProcessed) {
      logger.info({
        message: 'Duplicate WhatsApp inbound message ignored',
        whatsappMessageId: message.id,
      });
      return true;
    }

    const patient = await this.findPatientByPhone(message.from);
    if (!patient) {
      logger.warn({
        message: 'WhatsApp pilot message for unknown phone',
        from: message.from,
      });
      return false;
    }

    const conversation = await this.getOrCreateConversation(patient.id);
    const state = parseFlowState(conversation.flowState);
    const llmRuntime = localLlmService.getRuntimeConfig();

    await this.recordChatMessage({
      patientId: patient.id,
      direction: 'inbound',
      senderType: 'patient',
      content: message.text,
      flowStep: state.step,
      whatsappMessageId: message.id,
      whatsappStatus: 'received',
      metadata: {
        pilot: true,
        flowId: FLOW_ID,
        llmEnabled: llmRuntime.enabled,
      },
    });

    const normalizedPhone = normalizePhone(patient.whatsappPhone);
    const conversationMetadata =
      conversation.metadata && typeof conversation.metadata === 'object' && !Array.isArray(conversation.metadata)
        ? (conversation.metadata as Record<string, unknown>)
        : {};

    if (state.step === 'wellbeing') {
      let score = parseWellbeingScore(message.text);
      let parseSource: 'rule' | 'llm' | 'none' = score === null ? 'none' : 'rule';
      let sentiment: string = 'unknown';

      if (score === null && llmRuntime.enabled) {
        const llmResult = await localLlmService.interpretWellbeingScore(message.text);
        if (llmResult && llmResult.score !== null) {
          score = llmResult.score;
          parseSource = 'llm';
        }
        if (llmResult?.sentiment) {
          sentiment = llmResult.sentiment;
        }
      }

      if (score !== null && sentiment === 'unknown') {
        sentiment = score <= 3 ? 'negative' : score >= 8 ? 'positive' : 'neutral';
      }

      if (score === null) {
        await this.sendAndPersist(
          patient.id,
          normalizedPhone,
          'Please reply with a number from 0 to 10 for your wellbeing score.',
          'wellbeing'
        );
        return true;
      }

      await this.updateInboundMessageInterpretation({
        patientId: patient.id,
        whatsappMessageId: message.id,
        intentDetected: 'wellbeing_score',
        sentiment,
      });

      state.wellbeingScore = score;
      state.step = 'symptoms';

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          flowState: state as unknown as Prisma.InputJsonValue,
          lastMessageAt: new Date(),
          metadata: {
            ...conversationMetadata,
            lastInboundInterpretation: {
              step: 'wellbeing',
              source: parseSource,
              sentiment,
              messageId: message.id,
              interpretedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });

      await this.sendAndPersist(
        patient.id,
        normalizedPhone,
        'Are you experiencing concerning symptoms today (chest pain, shortness of breath at rest, fainting)? Reply YES or NO.',
        'symptoms'
      );

      return true;
    }

    if (state.step === 'symptoms') {
      let symptoms = parseYesNo(message.text);
      let parseSource: 'rule' | 'llm' | 'none' = symptoms === null ? 'none' : 'rule';
      let sentiment: string = 'unknown';

      if (symptoms === null && llmRuntime.enabled) {
        const llmResult = await localLlmService.interpretYesNo(
          message.text,
          'Are you experiencing concerning symptoms today?'
        );
        if (llmResult && llmResult.value !== null) {
          symptoms = llmResult.value;
          parseSource = 'llm';
        }
        if (llmResult?.sentiment) {
          sentiment = llmResult.sentiment;
        }
      }

      if (symptoms !== null && sentiment === 'unknown') {
        sentiment = symptoms ? 'distressed' : 'neutral';
      }

      if (symptoms === null) {
        await this.sendAndPersist(
          patient.id,
          normalizedPhone,
          'I did not understand. Please reply YES or NO for symptoms.',
          'symptoms'
        );
        return true;
      }

      await this.updateInboundMessageInterpretation({
        patientId: patient.id,
        whatsappMessageId: message.id,
        intentDetected: 'symptom_report',
        sentiment,
      });

      state.symptomsReported = symptoms;
      state.step = 'medications';

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          flowState: state as unknown as Prisma.InputJsonValue,
          lastMessageAt: new Date(),
          metadata: {
            ...conversationMetadata,
            lastInboundInterpretation: {
              step: 'symptoms',
              source: parseSource,
              sentiment,
              messageId: message.id,
              interpretedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });

      await this.sendAndPersist(
        patient.id,
        normalizedPhone,
        'Have you taken your prescribed medications today? Reply YES or NO.',
        'medications'
      );

      return true;
    }

    if (state.step === 'medications') {
      let meds = parseYesNo(message.text);
      let parseSource: 'rule' | 'llm' | 'none' = meds === null ? 'none' : 'rule';
      let sentiment: string = 'unknown';

      if (meds === null && llmRuntime.enabled) {
        const llmResult = await localLlmService.interpretYesNo(
          message.text,
          'Have you taken your prescribed medications today?'
        );
        if (llmResult && llmResult.value !== null) {
          meds = llmResult.value;
          parseSource = 'llm';
        }
        if (llmResult?.sentiment) {
          sentiment = llmResult.sentiment;
        }
      }

      if (meds !== null && sentiment === 'unknown') {
        sentiment = meds ? 'positive' : 'negative';
      }

      if (meds === null) {
        await this.sendAndPersist(
          patient.id,
          normalizedPhone,
          'I did not understand. Please reply YES or NO for medications.',
          'medications'
        );
        return true;
      }

      await this.updateInboundMessageInterpretation({
        patientId: patient.id,
        whatsappMessageId: message.id,
        intentDetected: 'medication_adherence',
        sentiment,
      });

      state.medicationsTaken = meds;
      state.step = 'completed';
      state.completedAt = new Date().toISOString();

      const ruleTriage = triageFromState(state);
      const wearableContext = await this.buildWearableContext(patient.id);
      const llmCompletion = llmRuntime.enabled
        ? await localLlmService.summarizeCheckIn({
            patientName: `${patient.user.firstName} ${patient.user.lastName}`.trim(),
            wellbeingScore: state.wellbeingScore ?? null,
            symptomsReported: state.symptomsReported ?? null,
            medicationsTaken: state.medicationsTaken ?? null,
            ruleTriage,
            wearableContext,
          })
        : null;

      const mergedRiskFlags = Array.from(
        new Set([
          ...(llmCompletion?.riskFlags || []),
          ...wearableContext.riskHints,
        ])
      ).slice(0, 12);
      const triageDecision = resolveFinalTriage({
        ruleTriage,
        llmTriage: llmCompletion?.triageSuggestion || null,
        llmConfidence: llmCompletion?.confidence ?? null,
        riskFlags: mergedRiskFlags,
        wearableContext,
      });
      const triage = triageDecision.final;
      const summary = llmCompletion?.summary || this.buildSummary(state, triage);
      const aiRiskFlags = mergedRiskFlags;

      await prisma.$transaction([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: 'resolved',
            resolvedAt: new Date(),
            flowState: state as unknown as Prisma.InputJsonValue,
            lastMessageAt: new Date(),
            metadata: {
              ...conversationMetadata,
              lastInboundInterpretation: {
                step: 'medications',
                source: parseSource,
                sentiment,
                messageId: message.id,
                interpretedAt: new Date().toISOString(),
              },
              llm: {
                enabled: llmRuntime.enabled,
                model: llmRuntime.model,
                completionConfidence: llmCompletion?.confidence ?? null,
                triageSuggestion: llmCompletion?.triageSuggestion ?? null,
              },
              triageDecision: {
                final: triageDecision.final,
                source: triageDecision.source,
                reasons: triageDecision.reasons,
              },
            } as Prisma.InputJsonValue,
          },
        }),
        prisma.checkIn.create({
          data: {
            patientId: patient.id,
            channel: 'whatsapp',
            wellbeingScore: state.wellbeingScore,
            symptoms: state.symptomsReported ? ['reported'] : [],
            medicationsTaken: state.medicationsTaken,
            triageOutcome: triage,
            requiresCallback: triage !== 'green',
            callbackPriority: triage === 'red' ? 'urgent' : triage === 'amber' ? 'same_day' : null,
            aiSummary: summary,
            aiRiskFlags,
            metadata: {
              pilot: true,
              flowId: FLOW_ID,
              llm: {
                enabled: llmRuntime.enabled,
                model: llmRuntime.model,
                baseUrl: llmRuntime.baseUrl,
                completionConfidence: llmCompletion?.confidence ?? null,
                triageRule: ruleTriage,
                triageFinal: triage,
              },
              triageDecision: {
                source: triageDecision.source,
                reasons: triageDecision.reasons,
              },
              wearableContext: wearableContext as unknown as Prisma.InputJsonValue,
            } as Prisma.InputJsonValue,
          },
        }),
        prisma.patient.update({
          where: { id: patient.id },
          data: {
            lastCheckIn: new Date(),
            wellbeingScore: state.wellbeingScore,
          },
        }),
      ]);

      if (triage !== 'green') {
        await prisma.alert.create({
          data: {
            patientId: patient.id,
            type: 'symptom_reported',
            severity: triage === 'red' ? 'critical' : 'medium',
            title: triage === 'red' ? 'Pilot follow-up RED flag' : 'Pilot follow-up AMBER flag',
            message: summary,
            triggerMetric: 'wellbeing_score',
            triggerValue: state.wellbeingScore,
            metadata: {
              pilot: true,
              flowId: FLOW_ID,
              symptomsReported: state.symptomsReported,
              medicationsTaken: state.medicationsTaken,
              llmConfidence: llmCompletion?.confidence ?? null,
              triageDecisionSource: triageDecision.source,
              aiRiskFlags,
            },
          },
        });
      }

      const completionMessage =
        triage === 'green'
          ? 'Thanks. Your follow-up is complete and your care team has received a GREEN update. We will check in again tomorrow.'
          : triage === 'amber'
            ? 'Thanks. Your follow-up is complete. We flagged this as AMBER for same-day clinical review. Please keep your phone available.'
            : 'Thanks. Your follow-up is complete. We flagged this as RED for urgent clinical review. If symptoms worsen, seek emergency care immediately.';

      await this.sendAndPersist(
        patient.id,
        normalizedPhone,
        completionMessage,
        'completed'
      );

      return true;
    }

    await this.sendAndPersist(
      patient.id,
      normalizedPhone,
      this.buildWellbeingPrompt(patient.user.firstName),
      'wellbeing'
    );

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'active',
        currentFlow: FLOW_ID,
        flowState: {
          step: 'wellbeing',
          startedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return true;
  }

  private async findPatientByPhone(phoneNumber: string): Promise<PilotPatient | null> {
    const candidates = phoneLookupCandidates(phoneNumber);

    const directMatch = await prisma.patient.findFirst({
      where: {
        whatsappOptedIn: true,
        whatsappPhone: { in: candidates },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (directMatch?.whatsappPhone) {
      return {
        id: directMatch.id,
        whatsappPhone: directMatch.whatsappPhone,
        user: {
          firstName: directMatch.user.firstName,
          lastName: directMatch.user.lastName,
        },
      };
    }

    const normalizedIncoming = normalizePhone(phoneNumber);
    const trailingDigits = normalizedIncoming.replace(/[^\d]/g, '').slice(-10);

    if (trailingDigits.length < 6) {
      return null;
    }

    const fallback = await prisma.patient.findMany({
      where: {
        whatsappOptedIn: true,
        whatsappPhone: {
          not: null,
          endsWith: trailingDigits,
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      take: 25,
    });

    for (const candidate of fallback) {
      if (candidate.whatsappPhone && normalizePhone(candidate.whatsappPhone) === normalizedIncoming) {
        return {
          id: candidate.id,
          whatsappPhone: candidate.whatsappPhone,
          user: {
            firstName: candidate.user.firstName,
            lastName: candidate.user.lastName,
          },
        };
      }
    }

    return null;
  }

  private async hasProcessedInboundMessage(whatsappMessageId: string): Promise<boolean> {
    const existing = await prisma.chatMessage.findFirst({
      where: {
        channel: 'whatsapp',
        direction: 'inbound',
        whatsappMessageId,
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  private async getOrCreateConversation(patientId: string) {
    const existing = await prisma.conversation.findFirst({
      where: {
        patientId,
        channel: 'whatsapp',
        status: 'active',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.conversation.create({
      data: {
        patientId,
        channel: 'whatsapp',
        currentFlow: FLOW_ID,
        status: 'active',
        flowState: {
          step: 'wellbeing',
          startedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private buildWellbeingPrompt(firstName: string): string {
    return `Hi ${firstName}, this is your CardioWatch daily follow-up. On a scale from 0 to 10, how are you feeling today?`;
  }

  private buildSummary(state: FollowUpState, triage: Triage): string {
    return [
      `Pilot follow-up ${FLOW_ID} completed with triage ${triage.toUpperCase()}.`,
      `Wellbeing score: ${state.wellbeingScore ?? 'n/a'}.`,
      `Symptoms reported: ${state.symptomsReported ? 'yes' : 'no'}.`,
      `Medications taken: ${state.medicationsTaken ? 'yes' : 'no'}.`,
    ].join(' ');
  }

  private async buildWearableContext(
    patientId: string,
    lookbackHours = 48
  ): Promise<WearableContextSnapshot> {
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const [readings, latestDevice] = await Promise.all([
      prisma.wearableReading.findMany({
        where: {
          patientId,
          readingDate: { gte: since },
        },
        orderBy: {
          readingDate: 'desc',
        },
        take: 80,
      }),
      prisma.wearableDevice.findFirst({
        where: {
          patientId,
          isConnected: true,
          lastSyncAt: { not: null },
        },
        orderBy: {
          lastSyncAt: 'desc',
        },
        select: {
          lastSyncAt: true,
        },
      }),
    ]);

    const latest = {
      avgHeartRate:
        readings.find((row) => typeof row.avgHeartRate === 'number')?.avgHeartRate ?? null,
      restingHeartRate:
        readings.find((row) => typeof row.restingHeartRate === 'number')?.restingHeartRate ?? null,
      bloodOxygenPercent: decimalToNumber(
        readings.find((row) => row.bloodOxygenPercent !== null)?.bloodOxygenPercent
      ),
      hrvMs: readings.find((row) => typeof row.hrvMs === 'number')?.hrvMs ?? null,
      sleepHours: decimalToNumber(readings.find((row) => row.sleepHours !== null)?.sleepHours),
      steps: readings.find((row) => typeof row.steps === 'number')?.steps ?? null,
    };

    const riskHints = new Set<string>();

    if (typeof latest.restingHeartRate === 'number' && latest.restingHeartRate >= 110) {
      riskHints.add(`High resting heart rate (${latest.restingHeartRate} bpm).`);
    }
    if (typeof latest.avgHeartRate === 'number' && latest.avgHeartRate >= 125) {
      riskHints.add(`Elevated average heart rate (${latest.avgHeartRate} bpm).`);
    }
    if (typeof latest.bloodOxygenPercent === 'number' && latest.bloodOxygenPercent <= 92) {
      riskHints.add(`Low blood oxygen (${latest.bloodOxygenPercent}%).`);
    }
    if (typeof latest.hrvMs === 'number' && latest.hrvMs <= 20) {
      riskHints.add(`Low HRV (${latest.hrvMs} ms).`);
    }
    if (typeof latest.sleepHours === 'number' && latest.sleepHours < 4) {
      riskHints.add(`Very low sleep duration (${latest.sleepHours.toFixed(1)}h).`);
    }

    return {
      generatedAt: new Date().toISOString(),
      lookbackHours,
      lastSyncAt: latestDevice?.lastSyncAt ? latestDevice.lastSyncAt.toISOString() : null,
      latest,
      riskHints: Array.from(riskHints),
    };
  }

  private extractIncomingMessages(payload: unknown): IncomingMessage[] {
    const results: IncomingMessage[] = [];

    if (!payload || typeof payload !== 'object') {
      return results;
    }

    const root = payload as Record<string, unknown>;
    const entries = Array.isArray(root['entry']) ? root['entry'] : [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const entryRecord = entry as Record<string, unknown>;
      const changes = Array.isArray(entryRecord['changes'])
        ? (entryRecord['changes'] as unknown[])
        : [];

      for (const change of changes) {
        if (!change || typeof change !== 'object') {
          continue;
        }

        const value = (change as Record<string, unknown>)['value'];
        if (!value || typeof value !== 'object') {
          continue;
        }

        const valueRecord = value as Record<string, unknown>;
        const messages = Array.isArray(valueRecord['messages'])
          ? (valueRecord['messages'] as unknown[])
          : [];

        for (const message of messages) {
          if (!message || typeof message !== 'object') {
            continue;
          }

          const obj = message as Record<string, unknown>;
          const id = typeof obj['id'] === 'string' ? obj['id'] : null;
          const from = typeof obj['from'] === 'string' ? obj['from'] : null;
          const text = this.extractTextFromWebhookMessage(obj);

          if (!id || !from || !text) {
            continue;
          }

          results.push({ id, from, text });
        }
      }
    }

    return results;
  }

  private extractStatuses(payload: unknown): MessageStatusUpdate[] {
    const statuses: MessageStatusUpdate[] = [];

    if (!payload || typeof payload !== 'object') {
      return statuses;
    }

    const root = payload as Record<string, unknown>;
    const entries = Array.isArray(root['entry']) ? root['entry'] : [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const entryRecord = entry as Record<string, unknown>;
      const changes = Array.isArray(entryRecord['changes'])
        ? (entryRecord['changes'] as unknown[])
        : [];

      for (const change of changes) {
        if (!change || typeof change !== 'object') {
          continue;
        }

        const value = (change as Record<string, unknown>)['value'];
        if (!value || typeof value !== 'object') {
          continue;
        }

        const valueRecord = value as Record<string, unknown>;
        const updates = Array.isArray(valueRecord['statuses'])
          ? (valueRecord['statuses'] as unknown[])
          : [];

        for (const update of updates) {
          if (!update || typeof update !== 'object') {
            continue;
          }

          const obj = update as Record<string, unknown>;
          const id = typeof obj['id'] === 'string' ? obj['id'] : null;
          const status = typeof obj['status'] === 'string' ? obj['status'] : null;

          if (id && status) {
            statuses.push({ id, status });
          }
        }
      }
    }

    return statuses;
  }

  private extractTextFromWebhookMessage(message: Record<string, unknown>): string | null {
    if (message['type'] === 'text' && message['text'] && typeof message['text'] === 'object') {
      const body = (message['text'] as Record<string, unknown>)['body'];
      return typeof body === 'string' ? body.trim() : null;
    }

    if (
      message['type'] === 'interactive' &&
      message['interactive'] &&
      typeof message['interactive'] === 'object'
    ) {
      const interactive = message['interactive'] as Record<string, unknown>;

      if (interactive['button_reply'] && typeof interactive['button_reply'] === 'object') {
        const title = (interactive['button_reply'] as Record<string, unknown>)['title'];
        return typeof title === 'string' ? title.trim() : null;
      }

      if (interactive['list_reply'] && typeof interactive['list_reply'] === 'object') {
        const title = (interactive['list_reply'] as Record<string, unknown>)['title'];
        return typeof title === 'string' ? title.trim() : null;
      }
    }

    if (message['type'] === 'button' && message['button'] && typeof message['button'] === 'object') {
      const text = (message['button'] as Record<string, unknown>)['text'];
      return typeof text === 'string' ? text.trim() : null;
    }

    return null;
  }

  private async sendAndPersist(
    patientId: string,
    phoneNumber: string,
    content: string,
    flowStep: FollowUpStep
  ): Promise<void> {
    const messageId = await this.sendTextMessage(phoneNumber, content);

    await this.recordChatMessage({
      patientId,
      direction: 'outbound',
      senderType: 'system',
      content,
      flowStep,
      whatsappMessageId: messageId,
      whatsappStatus: messageId ? 'sent' : 'failed',
      metadata: {
        pilot: true,
        flowId: FLOW_ID,
      },
    });
  }

  private async sendTextMessage(to: string, body: string): Promise<string | null> {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const token = env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !token) {
      logger.warn({
        message: 'WhatsApp pilot send skipped: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN',
      });
      return null;
    }

    const baseUrl = env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    const url = `${baseUrl.replace(/\/$/, '')}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({
        message: 'WhatsApp pilot send failed',
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };

    return data.messages?.[0]?.id || null;
  }

  private async updateInboundMessageInterpretation(args: {
    patientId: string;
    whatsappMessageId: string;
    intentDetected: string;
    sentiment: string;
  }): Promise<void> {
    await prisma.chatMessage.updateMany({
      where: {
        patientId: args.patientId,
        channel: 'whatsapp',
        direction: 'inbound',
        whatsappMessageId: args.whatsappMessageId,
      },
      data: {
        intentDetected: args.intentDetected,
        sentiment: args.sentiment,
      },
    });
  }

  private async recordChatMessage(data: {
    patientId: string;
    direction: string;
    senderType: string;
    content: string;
    flowStep: FollowUpStep;
    whatsappMessageId: string | null;
    whatsappStatus: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await prisma.chatMessage.create({
      data: {
        patientId: data.patientId,
        channel: 'whatsapp',
        direction: data.direction,
        senderType: data.senderType,
        messageType: 'text',
        content: data.content,
        flowStep: data.flowStep,
        whatsappMessageId: data.whatsappMessageId || undefined,
        whatsappStatus: data.whatsappStatus,
        isAutomated: true,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }
}

export const whatsappPilotService = new WhatsAppPilotService();
