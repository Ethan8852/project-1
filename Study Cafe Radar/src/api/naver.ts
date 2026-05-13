import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

interface NaverLocalItem {
  title: string;
  link: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

export const searchNaverPlace = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getEnv } = await import("../runtime/context");
    const env = getEnv();

    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(data.query)}&display=5&sort=comment`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
      },
    });

    if (!res.ok) throw new Error(`네이버 API 오류 (${res.status})`);

    const json = (await res.json()) as { items: NaverLocalItem[] };
    return json.items.map((item) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      address: item.roadAddress || item.address,
      telephone: item.telephone,
      link: item.link,
      mapx: item.mapx,
      mapy: item.mapy,
    }));
  });

export const getCompetitorInfo = createServerFn({ method: "GET" })
  .inputValidator(z.object({ address: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getDB, getEnv } = await import("../runtime/context");
    const { requireUserId } = await import("./auth");
    const env = getEnv();
    const userId = await requireUserId();

    const user = await getDB()
      .prepare("SELECT naver_place_id FROM users WHERE id = ?")
      .bind(userId)
      .first<{ naver_place_id: string | null }>();

    const areaMatch = data.address.match(/([가-힣]+(?:구|군))/);
    const area = areaMatch ? areaMatch[0] : data.address.split(" ").slice(0, 2).join(" ");

    // "스터디카페 {구}" 검색 — 경쟁사 수 + 순위 기준
    const searchUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(`스터디카페 ${area}`)}&display=20&sort=comment`;
    const res = await fetch(searchUrl, {
      headers: {
        "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
      },
    });
    if (!res.ok) throw new Error(`네이버 API 오류 (${res.status})`);

    const json = (await res.json()) as { items: NaverLocalItem[]; total: number };
    const items = json.items;

    // 내 매장 순위
    let estimatedRank: number | null = null;
    if (user?.naver_place_id) {
      const idx = items.findIndex((item) => item.link.includes(user.naver_place_id!));
      if (idx !== -1) estimatedRank = idx + 1;
    }

    // 경쟁사(내 매장 제외) 상위 5곳의 Naver Map 요약 조회 → 리뷰수·평점 수집
    const competitors = items
      .filter((item) => !user?.naver_place_id || !item.link.includes(user.naver_place_id!))
      .slice(0, 5);

    const competitorStats = (
      await Promise.all(
        competitors.map(async (item) => {
          const pid = item.link.match(/place\/(\d+)/)?.[1];
          if (!pid) return null;
          try {
            const r = await fetch(`https://map.naver.com/v5/api/sites/summary/${pid}?lang=ko`, {
              headers: { Referer: "https://map.naver.com/", "User-Agent": "Mozilla/5.0 (compatible)" },
            });
            if (!r.ok) return null;
            const d = (await r.json()) as Record<string, unknown>;
            const s = d.summary as Record<string, unknown> | undefined;
            const reviewCount = ((s?.reviewCount ?? 0) as number);
            const avgRating = ((s?.starScore ?? s?.avgScore ?? 0) as number);
            return { reviewCount, avgRating, healthScore: reviewCount * avgRating };
          } catch { return null; }
        }),
      )
    ).filter(Boolean) as { reviewCount: number; avgRating: number; healthScore: number }[];

    const avgReviews = competitorStats.length > 0
      ? Math.round(competitorStats.reduce((a, s) => a + s.reviewCount, 0) / competitorStats.length)
      : null;
    const avgRating = competitorStats.length > 0
      ? Math.round(competitorStats.reduce((a, s) => a + s.avgRating, 0) / competitorStats.length * 10) / 10
      : null;
    const avgHealthScore = competitorStats.length > 0
      ? competitorStats.reduce((a, s) => a + s.healthScore, 0) / competitorStats.length
      : null;

    return { competitorCount: Math.min(json.total, 20), estimatedRank, area, avgReviews, avgRating, avgHealthScore };
  });

function parsePlaceId(url: string): string | null {
  const match = url.match(/(?:place\/|entry\/place\/)(\d+)/);
  return match ? match[1] : null;
}

export const connectNaverPlace = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string() }))
  .handler(async ({ data }) => {
    const { getDB } = await import("../runtime/context");
    const { requireUserId } = await import("./auth");

    const placeId = parsePlaceId(data.url);
    if (!placeId) throw new Error("URL에서 플레이스 ID를 찾을 수 없습니다.\n예: https://map.naver.com/v5/entry/place/1234567890");

    let name = "";
    let address = "";
    let reviewCount: number | null = null;
    let avgRating: number | null = null;

    const res = await fetch(
      `https://map.naver.com/v5/api/sites/summary/${placeId}?lang=ko`,
      { headers: { Referer: "https://map.naver.com/", "User-Agent": "Mozilla/5.0 (compatible)" } },
    );
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      const s = json.summary as Record<string, unknown> | undefined;
      name = String(s?.name ?? s?.title ?? "");
      address = String(s?.roadAddress ?? s?.address ?? s?.fullAddress ?? "");
      reviewCount = (s?.reviewCount ?? null) as number | null;
      avgRating = ((s?.starScore ?? s?.avgScore ?? s?.rating) ?? null) as number | null;
    }

    const userId = await requireUserId();
    await getDB()
      .prepare("UPDATE users SET naver_place_id = ?, naver_place_url = ?, naver_address = ?, naver_place_name = ? WHERE id = ?")
      .bind(placeId, data.url, address, name, userId)
      .run();

    return { placeId, name, address, reviewCount, avgRating };
  });

export const getPlaceStats = createServerFn({ method: "GET" }).handler(async () => {
  const { getDB } = await import("../runtime/context");
  const { requireUserId } = await import("./auth");
  const userId = await requireUserId();

  const user = await getDB()
    .prepare("SELECT naver_place_id FROM users WHERE id = ?")
    .bind(userId)
    .first<{ naver_place_id: string | null }>();

  const placeId = user?.naver_place_id;
  if (!placeId) return { reviewCount: null, avgRating: null };

  const res = await fetch(
    `https://map.naver.com/v5/api/sites/summary/${placeId}?lang=ko`,
    { headers: { Referer: "https://map.naver.com/", "User-Agent": "Mozilla/5.0 (compatible)" } },
  );
  if (!res.ok) return { reviewCount: null, avgRating: null };

  const data = (await res.json()) as Record<string, unknown>;
  const summary = data.summary as Record<string, unknown> | undefined;
  return {
    reviewCount: (summary?.reviewCount ?? null) as number | null,
    avgRating: ((summary?.starScore ?? summary?.avgScore ?? summary?.rating) ?? null) as number | null,
  };
});

export const linkNaverPlace = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      naverPlaceId: z.string(),
      naverPlaceUrl: z.string().url(),
      naverAddress: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { getDB } = await import("../runtime/context");
    const { requireUserId } = await import("./auth");
    const userId = await requireUserId();
    await getDB()
      .prepare("UPDATE users SET naver_place_id = ?, naver_place_url = ?, naver_address = ? WHERE id = ?")
      .bind(data.naverPlaceId, data.naverPlaceUrl, data.naverAddress, userId)
      .run();
    return { ok: true };
  });
