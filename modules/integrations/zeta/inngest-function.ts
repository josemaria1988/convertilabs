import { inngest } from "@/lib/inngest/client";
import { runQueuedZetaSyncRun } from "@/modules/integrations/zeta/sync/sync-runner";

export const zetaSyncRequested = inngest.createFunction(
  {
    id: "integrations-zeta-sync-requested",
    retries: 2,
    concurrency: {
      limit: 1,
      key: "event.data.organizationId + ':' + event.data.stream",
    },
  },
  {
    event: "integrations/zeta.sync.requested",
  },
  async ({ event, step, logger }) => {
    logger.info("Starting Zetasoftware sync run.", {
      runId: event.data.runId,
      organizationId: event.data.organizationId,
      stream: event.data.stream,
    });

    return step.run("run-zeta-sync", async () => {
      return runQueuedZetaSyncRun({
        runId: event.data.runId,
        organizationId: event.data.organizationId,
        actorUserId: event.data.requestedBy,
      });
    });
  },
);
