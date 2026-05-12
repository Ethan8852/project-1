import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const KpiInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식: YYYY-MM-DD"),
  weeklyInflow: z.number().int().nonnegative().optional(),
  weeklyChangeRate: z.number().optional(),
  searchRank: z.number().int().positive().optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  avgRating: z.number().min(0).max(5).optional(),
  monthlyVisitors: z.number().int().nonnegative().optional(),
  myInflow: z.number().int().nonnegative().optional(),
  areaAvgInflow: z.number().int().nonnegative().optional(),
  competitorCount: z.number().int().nonnegative().optional(),
  percentile: z.number().int().min(0).max(100).optional(),
  radius: z.string().optional(),
});

export const saveKpi = createServerFn({ method: "POST" })
  .inputValidator(KpiInputSchema)
  .handler(async ({ data }) => {
    const { getDB } = await import("../runtime/context");
    const { requireUserId } = await import("./auth");
    const userId = await requireUserId();
    const db = getDB();
    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO kpi_snapshots
          (id, user_id, date, weekly_inflow, weekly_change_rate, search_rank,
           review_count, avg_rating, monthly_visitors, my_inflow, area_avg_inflow,
           competitor_count, percentile, radius)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET
           weekly_inflow      = excluded.weekly_inflow,
           weekly_change_rate = excluded.weekly_change_rate,
           search_rank        = excluded.search_rank,
           review_count       = excluded.review_count,
           avg_rating         = excluded.avg_rating,
           monthly_visitors   = excluded.monthly_visitors,
           my_inflow          = excluded.my_inflow,
           area_avg_inflow    = excluded.area_avg_inflow,
           competitor_count   = excluded.competitor_count,
           percentile         = excluded.percentile,
           radius             = excluded.radius`,
      )
      .bind(
        id, userId, data.date,
        data.weeklyInflow ?? null, data.weeklyChangeRate ?? null,
        data.searchRank ?? null, data.reviewCount ?? null,
        data.avgRating ?? null, data.monthlyVisitors ?? null,
        data.myInflow ?? null, data.areaAvgInflow ?? null,
        data.competitorCount ?? null, data.percentile ?? null,
        data.radius ?? null,
      )
      .run();

    return { ok: true };
  });

export const getLatestKpi = createServerFn({ method: "GET" }).handler(async () => {
  const { getDB } = await import("../runtime/context");
  const { requireUserId } = await import("./auth");
  const userId = await requireUserId();
  const row = await getDB()
    .prepare(`SELECT * FROM kpi_snapshots WHERE user_id = ? ORDER BY date DESC LIMIT 1`)
    .bind(userId)
    .first();
  return row ?? null;
});

export const getKpiHistory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().int().positive().default(30) }))
  .handler(async ({ data }) => {
    const { getDB } = await import("../runtime/context");
    const { requireUserId } = await import("./auth");
    const userId = await requireUserId();
    const result = await getDB()
      .prepare(
        `SELECT date, weekly_inflow, search_rank
         FROM kpi_snapshots WHERE user_id = ?
         ORDER BY date DESC LIMIT ?`,
      )
      .bind(userId, data.days)
      .all();
    return result.results.reverse();
  });
