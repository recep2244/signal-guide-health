import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    PILOT_FOLLOWUP_SCHEDULER_ENABLED: true,
    PILOT_FOLLOWUP_INTERVAL_MINUTES: 1440,
    PILOT_FOLLOWUP_BATCH_LIMIT: 25,
  },
  whatsappPilotService: {
    startFollowUpBatch: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../src/config/env', () => ({ env: mocks.env }));
vi.mock('../src/services/whatsappPilotService', () => ({
  whatsappPilotService: mocks.whatsappPilotService,
}));
vi.mock('../src/utils/logger', () => ({ logger: mocks.logger }));

import { pilotSchedulerService } from '../src/services/pilotSchedulerService';

describe('pilotSchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.whatsappPilotService.startFollowUpBatch.mockResolvedValue({
      attempted: 1,
      sent: 1,
      errors: [],
    });
  });

  it('runs startup cycle when enabled', async () => {
    pilotSchedulerService.start();

    await vi.advanceTimersByTimeAsync(15_000);

    expect(mocks.whatsappPilotService.startFollowUpBatch).toHaveBeenCalledWith(25);
    pilotSchedulerService.stop();
  });
});
