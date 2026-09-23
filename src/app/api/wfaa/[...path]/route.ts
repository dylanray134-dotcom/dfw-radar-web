export const dynamic = "force-dynamic";

const CDN = "https://cdn.tegna-media.com/wfaa/weather/myownradar/750x422/";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  if (!rel || rel.includes("..") || !/^[\w./-]+$/.test(rel)) {
    return new Response("Bad path", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(CDN + rel, {
      headers: {
        "User-Agent": "DFWRadar/1.0",
        Accept: "*/*",
      },
      cache: "no-store",
    });
  } catch {
    return new Response("Radar CDN unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(upstream.statusText || "Upstream error", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  const isText = /\.(txt|html|json)$/i.test(rel);
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": isText ? "public, max-age=20" : "public, max-age=300",
    },
  });
}
