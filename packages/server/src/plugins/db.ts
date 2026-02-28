import fp from "fastify-plugin";
import { db } from "../db/client";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

export const dbPlugin = fp(async (app) => {
  app.decorate("db", db);
});

