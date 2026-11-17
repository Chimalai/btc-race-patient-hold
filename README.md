# Patient Hold cbBTC

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Chimalai/btc-race-patient-hold/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Chimalai/btc-race-patient-hold/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A long-only cbBTC trading bot for make.fun's "Race a BTC trading bot live
for 24 hours" bounty (bars-replay/v1). It enters once with 97% of its cash,
holds through chop, and leaves only on a 4.5% disaster brake or an armed
3.5% trailing profit lock. See the header comment in `main.ts` for the full
rationale.

## Run it

```sh
node main.ts < bars.ndjson
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout via the vendored
shim in `vendor/makefun-bars.ts`.

---
<sub>Entered on [make.fun](https://make.fun/bounty/btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
