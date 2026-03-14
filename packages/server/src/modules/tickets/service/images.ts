import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { getConfig } from "../../../config";
import { AppError } from "../../../shared/errors";
import { logServerEvent, withServerSpan } from "../../../shared/observability";
import { getTicketOrThrow } from "./queries";

const supportedTicketImageMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"]
]);

function getTicketUploadsRoot() {
  return path.resolve(getConfig().uploadsPath, "tickets");
}

function getTicketUploadsDirectory(ticketId: number) {
  return path.resolve(getTicketUploadsRoot(), String(ticketId));
}

function getReferencedTicketImageFilenames(description: string, ticketId: number) {
  const imageMatches = description.matchAll(
    new RegExp(`/api/tickets/${ticketId}/images/([^\\s)]+)`, "g")
  );

  return new Set(
    Array.from(imageMatches, (match) => {
      try {
        return decodeURIComponent(match[1] ?? "");
      } catch {
        return match[1] ?? "";
      }
    }).filter(Boolean)
  );
}

function sanitizeFilenameSegment(input: string) {
  const normalized = input
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "image";
}

function filenameToAltText(filename: string) {
  const baseName = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return baseName || "Pasted image";
}

function escapeMarkdownText(input: string) {
  return input.replace(/[[\]\\]/g, "\\$&");
}

function resolveTicketImageContentType(filename: string) {
  const extension = path.extname(filename).slice(1).toLowerCase();

  for (const [contentType, mappedExtension] of supportedTicketImageMimeTypes) {
    if (mappedExtension === extension) {
      return contentType;
    }
  }

  return "application/octet-stream";
}

function assertTicketImagePath(ticketId: number, filename: string) {
  const ticketDirectory = getTicketUploadsDirectory(ticketId);
  const resolvedPath = path.resolve(ticketDirectory, filename);

  if (path.dirname(resolvedPath) !== ticketDirectory) {
    throw new AppError(400, "INVALID_TICKET_IMAGE_PATH", "Invalid ticket image path");
  }

  return resolvedPath;
}

export async function cleanupTicketImages(
  app: FastifyInstance,
  ticketId: number,
  nextDescription: string
) {
  const ticketDirectory = getTicketUploadsDirectory(ticketId);
  const nextFilenames = getReferencedTicketImageFilenames(nextDescription, ticketId);
  let directoryEntries: string[] = [];

  try {
    directoryEntries = await readdir(ticketDirectory);
  } catch {
    return;
  }

  const orphanedFilenames = directoryEntries.filter((filename) => !nextFilenames.has(filename));

  if (!orphanedFilenames.length) {
    return;
  }

  await Promise.all(
    orphanedFilenames.map(async (filename) => {
      try {
        await rm(assertTicketImagePath(ticketId, filename), { force: true });
      } catch (error) {
        logServerEvent(app, "warn", "ticket.image.cleanup.remove_failed", {
          ticketId,
          filename,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })
  );

  try {
    const remainingEntries = await readdir(ticketDirectory);

    if (!remainingEntries.length) {
      await rm(ticketDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    logServerEvent(app, "warn", "ticket.image.cleanup.directory_cleanup_failed", {
      ticketId,
      directory: ticketDirectory,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function saveTicketImage(app: FastifyInstance, ticketId: number, file: MultipartFile) {
  return withServerSpan(
    app,
    "ticket.image.upload",
    {
      ticketId,
      filename: file.filename,
      mimeType: file.mimetype
    },
    async () => {
      await getTicketOrThrow(app, ticketId);

      const extension = supportedTicketImageMimeTypes.get(file.mimetype);

      if (!extension) {
        throw new AppError(400, "UNSUPPORTED_TICKET_IMAGE_TYPE", "Only PNG, JPEG, GIF, and WebP images are supported");
      }

      const buffer = await file.toBuffer();

      if (!buffer.byteLength) {
        throw new AppError(400, "EMPTY_TICKET_IMAGE", "Image file is empty");
      }

      const ticketDirectory = getTicketUploadsDirectory(ticketId);
      await mkdir(ticketDirectory, { recursive: true });

      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeFilenameSegment(file.filename)}.${extension}`;
      const targetPath = path.resolve(ticketDirectory, filename);
      await writeFile(targetPath, buffer);

      const alt = filenameToAltText(file.filename);
      const url = `/api/tickets/${ticketId}/images/${filename}`;

      logServerEvent(app, "info", "ticket.image.upload.persisted", {
        ticketId,
        filename,
        sizeBytes: buffer.byteLength
      });

      return {
        alt,
        filename,
        url,
        markdown: `![${escapeMarkdownText(alt)}](${url})`
      };
    }
  );
}

export async function streamTicketImage(app: FastifyInstance, ticketId: number, filename: string) {
  await getTicketOrThrow(app, ticketId);

  const imagePath = assertTicketImagePath(ticketId, filename);

  try {
    const imageStats = await stat(imagePath);

    if (!imageStats.isFile()) {
      throw new AppError(404, "TICKET_IMAGE_NOT_FOUND", "Ticket image not found");
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(404, "TICKET_IMAGE_NOT_FOUND", "Ticket image not found");
  }

  return {
    contentType: resolveTicketImageContentType(filename),
    stream: createReadStream(imagePath)
  };
}
