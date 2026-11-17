// Patient-hold cbBTC bot for make.fun's bars-replay/v1.
//
// Strategy (designed against the kit's published dev window and its
// baselines): the dev window is a choppy grind where every active baseline
// that trades often (EMA cross, ADX momentum, RSI/Bollinger) bleeds fees and
// price impact on each round trip, while simply holding ends positive. So
// this bot:
//
//   - enters once, with 97% of its cash, on the first batch it may trade on,
//   - then holds through ordinary chop, and
//   - leaves only on a disaster brake: the position worth 4.5% under its
//     cost (fees included) at a close, after which it stays in cash for the
//     rest of the window (no re-entry, so a V-shaped dip cannot whipsaw it
//     twice),
//   - or on a profit lock: once the position has been worth 3% over its
//     cost, a fall to 3.5% under that peak value sells it.
//
// All decisions are bigint comparisons on the shim's state, so two runs on
// the same bars produce the same orders byte for byte. The wire protocol is
// the vendored shim's (vendor/makefun-bars.ts, a copy of the kit's
// sdk/makefun-bars.ts).

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 100;
/** Enter with 97% of cash: the remaining 3% covers the buy's fee and impact. */
const ENTRY_CASH_NUM = 97n;
const ENTRY_CASH_DEN = 100n;
/** Disaster brake: value at or under cost * 955/1000 sells everything. */
const DISASTER_NUM = 955n;
/** Profit lock arms when the peak value reaches cost * 103/100 ... */
const ARM_NUM = 103n;
/** ... and sells when value falls to peak * 965/1000. */
const TRAIL_NUM = 965n;
const RATIO_DEN = 1000n;

/** A disaster/profit-lock sell has been sent: never buy again. */
let done = false;
/** Highest position value seen at a close, in quote units. */
let peakValue = 0n;

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];
    const held = state.positions.get(SYMBOL);

    if (held === undefined) {
      if (done) return [];
      const amount = (state.cash * ENTRY_CASH_NUM) / ENTRY_CASH_DEN;
      if (amount < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      return [
        {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: amount,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }

    const value = state.value(SYMBOL, held.qty);
    if (value > peakValue) peakValue = value;

    let sell = done; // an earlier sell was refused; send it again
    if (value * RATIO_DEN <= held.cost * DISASTER_NUM) sell = true;
    if (
      peakValue * 100n >= held.cost * ARM_NUM &&
      value * RATIO_DEN <= peakValue * TRAIL_NUM
    ) {
      sell = true;
    }
    if (!sell) return [];
    done = true;
    return [
      {
        side: 'sell',
        symbol: SYMBOL,
        qty: held.qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      },
    ];
  },
});
