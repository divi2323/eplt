export function roundWhole(n: number) {
  return Math.round(n);
}

export function calcGross(opts: {
  buyins: number;
  rebuys: number;
  addons: number;
  buyin: number;
  rebuy: number;
  addon: number;
}) {
  return opts.buyins * opts.buyin + opts.rebuys * opts.rebuy + opts.addons * opts.addon;
}

export function calcPrizePool(gross: number) {
  return Math.round(gross * 0.4);
}

export function calcPayouts(prizePool: number) {
  const perc = [0.4, 0.28, 0.18, 0.14];

  const raw = perc.map((p) => Math.round(prizePool * p));
  const sum = raw.reduce((a, b) => a + b, 0);
  const remainder = prizePool - sum;
  raw[0] += remainder;

  return [
    { place: 1, amount: raw[0] },
    { place: 2, amount: raw[1] },
    { place: 3, amount: raw[2] },
    { place: 4, amount: raw[3] },
  ];
}

export function calcSponsorPointsTotal(gross: number) {
  return Math.round(gross * 0.5);
}

export function calcShowUpEach(totalSponsorPoints: number, totalEntries: number) {
  const showUpTier = Math.floor(totalSponsorPoints * 0.2);
  const each = Math.floor(showUpTier / totalEntries);
  return { showUpTier, each };
}

export function neauScore(params: {
  totalEntries: number;
  buyin: number;
  sumPlayersBuyins: number;
  finishPos0: number;
}) {
  const { totalEntries, buyin, sumPlayersBuyins, finishPos0 } = params;
  const numerator = totalEntries * buyin ** 2;
  const base = numerator / sumPlayersBuyins / (finishPos0 + 1);
  return Math.sqrt(base);
}
