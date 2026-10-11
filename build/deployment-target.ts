/** Workers Builds identifies itself independently of ordinary CI and Sites. */
export function usesStandaloneCloudflare(command: string, environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (command !== "build") return false;
  const target = environment.YULIN_DEPLOY_TARGET;
  if (target && target !== "sites" && target !== "cloudflare") {
    throw new Error("YULIN_DEPLOY_TARGET must be sites or cloudflare.");
  }
  return target ? target === "cloudflare" : environment.WORKERS_CI === "1";
}
