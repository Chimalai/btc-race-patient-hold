# Patient Hold cbBTC

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
