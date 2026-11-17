// Patient-reversion cbBTC bot for make.fun's bars-replay/v1.
//
// Designed against the kit's published dev window and its baselines. The
// window (and BTC generally, at this scale) is range-bound chop around a
// slow mean: trend-following baselines whipsaw themselves to death on fees
// and impact (the kit's EMA-cross baseline loses ~10% of the account), and
// plain buy-and-hold keeps all of the chop's downside. What the data does
// reward is patience at the band edges:
//
//   - Keep a 240-bar simple moving average of closes (warm-up bars count).
//   - Flat and the close is at or under 99.6% of that average: buy with 97%
//     of cash. Dips to a slow mean, in a range, are the cheap seats.
//   - Holding and the close reaches 100.8% of the average: sell everything.
//     The round trip banks the spread between the bands (~1.2% gross)
//     against ~0.35% of fees, slippage and impact, and the bot may re-enter
//     on the next dip.
//   - Disaster brake: a position worth 7% under its cost at a close sells
//     and ends the bot's window (no re-entry), so a dip that turns into a
//     crash cannot compound.
//   - Participation fallback: if no trade has happened by bar 600 of the
//     scored window (a one-way market that never dips), buy 50% of cash
//     while the close is within 1.5% over the average, so the bot is never
//     left with zero trades; the same band exit and brake manage it.
//
// All decisions are bigint comparisons on the shim's state and the close
// history, so two runs on the same bars produce the same orders byte for
// byte. The wire protocol is the vendored shim's (vendor/makefun-bars.ts,
// a copy of the kit's sdk/makefun-bars.ts).

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 100;
/** SMA length in bars. */
const SMA_N = 240n;
/** Buy when close * 1000 <= sma * 996 (0.4% under the mean). */
const BUY_BAND = 996n;
/** Sell when close * 1000 >= sma * 1008 (0.8% over the mean). */
const SELL_BAND = 1008n;
/** Fallback buy allowed while close * 1000 <= sma * 1015. */
const FALLBACK_BAND = 1015n;
/** Disaster brake: value * 100 <= cost * 93 sells and ends the window. */
const BRAKE = 93n;
/** Scored bar by which the fallback may fire. */
const FALLBACK_BAR = 600;
/** Enter with 97% of cash on a band entry. */
const ENTRY_NUM = 97n;
/** Enter with 50% of cash on the participation fallback. */
const FALLBACK_NUM = 50n;
const CASH_DEN = 100n;
const BAND_DEN = 1000n;

/** Every CBBTC close seen, in order (bigint raw units). */
const closes: bigint[] = [];
/** Running sum of the last SMA_N closes. */
let windowSum = 0n;
/** Bars seen while trading was open. */
let scoredBars = 0;
/** A position has been held at some point. */
let hasTraded = false;
/** The disaster brake has fired: never trade again. */
let done = false;
/** A sell has been sent but the position is still there: send it again. */
let sellSent = false;

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      const close = BigInt(bar.c);
      closes.push(close);
      windowSum += close;
      if (BigInt(closes.length) > SMA_N) {
        windowSum -= closes[closes.length - Number(SMA_N) - 1];
      }
    }
    if (state.warmingUp) return [];
    scoredBars += 1;

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      hasTraded = true;
      const value = state.value(SYMBOL, held.qty);
      if (value * 100n <= held.cost * BRAKE) {
        done = true;
        sellSent = true;
        return [
          {
            side: 'sell',
            symbol: SYMBOL,
            qty: held.qty,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      if (sellSent) {
        return [
          {
            side: 'sell',
            symbol: SYMBOL,
            qty: held.qty,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      if (BigInt(closes.length) >= SMA_N) {
        const sma = windowSum / SMA_N;
        const close = closes[closes.length - 1];
        if (close * BAND_DEN >= sma * SELL_BAND) {
          sellSent = true;
          return [
            {
              side: 'sell',
              symbol: SYMBOL,
              qty: held.qty,
              max_slippage_bps: MAX_SLIPPAGE_BPS,
            },
          ];
        }
      }
      return [];
    }

    sellSent = false;
    if (done) return [];
    if (BigInt(closes.length) < SMA_N) return [];
    const sma = windowSum / SMA_N;
    const close = closes[closes.length - 1];
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);

    if (close * BAND_DEN <= sma * BUY_BAND) {
      const amount = (state.cash * ENTRY_NUM) / CASH_DEN;
      if (amount < minNotional) return [];
      return [
        {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: amount,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    if (
      !hasTraded &&
      scoredBars >= FALLBACK_BAR &&
      close * BAND_DEN <= sma * FALLBACK_BAND
    ) {
      const amount = (state.cash * FALLBACK_NUM) / CASH_DEN;
      if (amount < minNotional) return [];
      return [
        {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: amount,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});
