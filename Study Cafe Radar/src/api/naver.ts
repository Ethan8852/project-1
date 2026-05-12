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
