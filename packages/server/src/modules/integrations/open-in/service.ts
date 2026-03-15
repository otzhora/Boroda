import type { FastifyInstance } from "fastify";
import { logServerEvent, withServerSpan } from "../../../shared/observability";
import { getTicketOrThrow } from "../../tickets/service";
import { openInApp } from "./launcher";
import type { OpenInAppInput, OpenTicketInAppInput } from "./types";
import { resolveTicketOpenDirectory } from "./workspace-resolution";

export type { OpenInAppInput, OpenInMode, OpenInTarget, OpenTicketInAppInput } from "./types";
export { openInApp } from "./launcher";

export async function openTicketInApp(app: FastifyInstance, ticketId: number, input: OpenTicketInAppInput) {
  return withServerSpan(
    app,
    "ticket.open_in",
    {
      ticketId,
      target: input.target,
      mode: input.mode,
      folderId: input.folderId,
      workspaceId: input.workspaceId,
      runSetup: input.runSetup
    },
    async () => {
      const ticket = await getTicketOrThrow(app, ticketId);
      const { directory, folderId } = await resolveTicketOpenDirectory(app, ticket, input);

      logServerEvent(app, "info", "ticket.open_in.directory_resolved", {
        ticketId,
        directory,
        folderId,
        mode: input.mode,
        target: input.target
      });

      const launchRequest: OpenInAppInput = {
        directory,
        target: input.target
      };

      return openInApp(launchRequest);
    }
  );
}
