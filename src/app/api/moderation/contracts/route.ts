export function GET(request: Request) {
  const contractsUrl = new URL(request.url);
  contractsUrl.pathname = "/api/contracts";
  contractsUrl.searchParams.set("moderation", "true");

  return new Response(null, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
      Location: `${contractsUrl.pathname}${contractsUrl.search}`,
    },
  });
}
