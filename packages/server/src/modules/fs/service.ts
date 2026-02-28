import { resolvePathInfo } from "../../shared/path-utils";

export async function validatePath(input: string) {
  return resolvePathInfo(input);
}

