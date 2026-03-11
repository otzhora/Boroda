import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { deleteBoardColumn, insertBoardColumn, listBoardColumns, renameBoardColumn } from "./columns";
import { getBoard } from "./service";

const boardQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  q: z.string().optional()
});

const boardColumnParamSchema = z.object({
  status: z.string().trim().min(1)
});

const createBoardColumnSchema = z.object({
  label: z.string().trim().min(1).max(48),
  relativeToStatus: z.string().trim().min(1),
  placement: z.enum(["before", "after"])
});

const updateBoardColumnSchema = z.object({
  label: z.string().trim().min(1).max(48)
});

export const boardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/board", async (request) => {
    const query = boardQuerySchema.parse(request.query);
    return getBoard(app, query);
  });

  app.get("/board-columns", async () => {
    return {
      columns: await listBoardColumns(app)
    };
  });

  app.post("/board-columns", async (request) => {
    const payload = createBoardColumnSchema.parse(request.body);
    return {
      columns: await insertBoardColumn(app, payload)
    };
  });

  app.patch("/board-columns/:status", async (request) => {
    const params = boardColumnParamSchema.parse(request.params);
    const payload = updateBoardColumnSchema.parse(request.body);
    return {
      columns: await renameBoardColumn(app, {
        status: params.status,
        label: payload.label
      })
    };
  });

  app.delete("/board-columns/:status", async (request) => {
    const params = boardColumnParamSchema.parse(request.params);
    return {
      columns: await deleteBoardColumn(app, params.status)
    };
  });
};
