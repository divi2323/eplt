/**
 * Sponsor Points Preview (PUBLIC-SAFE)
 *
 * Points come from sponsor allocation dollars, converted 1:1 into points.
 * Demo locked config:
 * - Sponsor allocation = derived from clock economics (typically league stake pool).
 * - Show-up tier = 20% (equal to all entrants; truncate remainder; remainder NOT distributed)
 * - Finish-position tier = 30% (all entrants; proportional via Neau score)
 * - Winner tier = 50% (top paid places only; proportional via Neau score)
 *
 * Neau score (0-based finish_position):
 * score = sqrt( (total_entries * buyin^2 / sum_of_players_buyins) / (finish_position + 1) )
 *
 * We interpret sum_of_players_buyins as total gross collected (buyins+rebuys+addons) for the event.
 */

export type PointsRow = {
  place: number;          // 1-based
  showUp: number;
  finishTier: number;
  winnerTier: number;
  total: number;
};

function neauScore(args: { totalEntries: number; buyin: number; sumBuyins: number; finishPos0: number }) {
  const { totalEntries, buyin, sumBuyins, finishPos0 } = args;
  const numerator = totalEntries * (buyin * buyin);
  const ratio = sumBuyins > 0 ? numerator / sumBuyins : 0;
  const denom = finishPos0 + 1;
  const v = denom > 0 ? ratio / denom : 0;
  return Math.sqrt(Math.max(0, v));
}

function allocProportional(totalPoints: number, scores: number[]) {
  const sum = scores.reduce((a, b) => a + b, 0);
  if (!sum || totalPoints <= 0) return scores.map(() => 0);

  const raw = scores.map((s) => (totalPoints * s) / sum);
  const rounded = raw.map((x) => Math.round(x));

  const delta = totalPoints - rounded.reduce((a, b) => a + b, 0);
  if (rounded.length > 0) rounded[0] += delta;

  return rounded;
}

export function computePointsPreview(args: {
  entries: number;
  paidPlaces: number;
  buyin: number;
  gross: number;
  /** If provided, overrides derived sponsor total (points in play). */
  sponsorTotalOverride?: number;
}): { sponsorTotal: number; showUpEach: number; rows: PointsRow[] } {
  const entries = Math.max(0, Math.floor(args.entries));
  const paidPlaces = Math.max(0, Math.floor(args.paidPlaces));
  const buyin = Number(args.buyin) || 0;
  const gross = Number(args.gross) || 0;

  const sponsorTotal = Number.isFinite(args.sponsorTotalOverride as any)
    ? Math.max(0, Math.floor(Number(args.sponsorTotalOverride)))
    : Math.round(gross * 0.50);

  const showUpPool = Math.floor(sponsorTotal * 0.20);
  const finishPool = Math.round(sponsorTotal * 0.30);
  const winnerPool = sponsorTotal - showUpPool - finishPool;

  const showUpEach = entries > 0 ? Math.floor(showUpPool / entries) : 0;

  const sumBuyins = gross;
  const allScores = Array.from({ length: entries }, (_, i) =>
    neauScore({ totalEntries: entries, buyin, sumBuyins, finishPos0: i })
  );

  const finishAlloc = allocProportional(finishPool, allScores);

  const winnerScores = allScores.slice(0, paidPlaces);
  const winnerAllocTop = allocProportional(winnerPool, winnerScores);

  const rows: PointsRow[] = [];
  for (let i = 0; i < entries; i++) {
    const showUp = showUpEach;
    const finishTier = finishAlloc[i] ?? 0;
    const winnerTier = i < paidPlaces ? (winnerAllocTop[i] ?? 0) : 0;
    const total = showUp + finishTier + winnerTier;
    rows.push({ place: i + 1, showUp, finishTier, winnerTier, total });
  }

  return { sponsorTotal, showUpEach, rows };
}
