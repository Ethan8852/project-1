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

    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(`스터디카페 ${area}`)}&display=20&sort=comment`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
      },
    });
    if (!res.ok) throw new Error(`네이버 API 오류 (${res.status})`);

    const json = (await res.json()) as { items: NaverLocalItem[]; total: number };
    const items = json.items;

    let estimatedRank: number | null = null;
    if (user?.naver_place_id) {
      const idx = items.findIndex((item) => item.link.includes(user.naver_place_id!));
      if (idx !== -1) estimatedRank = idx + 1;
    }

    return { competitorCount: Math.min(json.total, 20), estimatedRank, area };
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
