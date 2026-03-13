import { env } from '../config/env';
import { logger } from '../utils/logger';
import { whatsappPilotService } from './whatsappPilotService';

class PilotSchedulerService {
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (!env.PILOT_FOLLOWUP_SCHEDULER_ENABLED) {
      logger.info({ message: 'Pilot follow-up scheduler disabled' });
      return;
    }

    const intervalMinutes = Math.max(5, env.PILOT_FOLLOWUP_INTERVAL_MINUTES || 1440);
    const intervalMs = intervalMinutes * 60 * 1000;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    logger.info({
      message: 'Pilot follow-up scheduler started',
      intervalMinutes,
      batchLimit: Math.max(1, Math.min(100, env.PILOT_FOLLOWUP_BATCH_LIMIT || 25)),
    });

    // Run once shortly after startup, then on interval.
    setTimeout(() => {
      void this.runCycle('startup');
    }, 15_000);

    this.intervalHandle = setInterval(() => {
      void this.runCycle('interval');
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async runCycle(trigger: 'startup' | 'interval'): Promise<void> {
    if (this.running) {
      logger.warn({ message: 'Pilot scheduler cycle skipped; previous cycle still running' });
      return;
    }

    this.running = true;
    const limit = Math.max(1, Math.min(100, env.PILOT_FOLLOWUP_BATCH_LIMIT || 25));

    try {
      const result = await whatsappPilotService.startFollowUpBatch(limit);
      logger.info({
        message: 'Pilot scheduler follow-up cycle completed',
        trigger,
        attempted: result.attempted,
        sent: result.sent,
        errors: result.errors.length,
      });
    } catch (error) {
      logger.error({
        message: 'Pilot scheduler follow-up cycle failed',
        trigger,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.running = false;
    }
  }
}

export const pilotSchedulerService = new PilotSchedulerService();

