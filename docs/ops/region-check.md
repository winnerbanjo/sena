# Function and database region check

Use this checklist to confirm that the Vercel function region and the DigitalOcean database region match, or to quantify the cost if they do not. This is a verification checklist; it does not change configuration.

## Historical baseline to compare against

| Item | Historical value |
| --- | --- |
| Vercel function region | `iad1` |
| DigitalOcean database region | `LON1` |
| Observed round trip | 129–283 ms |

Those figures came from a cross-region setup. Treat them as the "before" baseline: a matching region should be materially lower and less variable. Record the date and source of any new measurement.

## Checklist

1. In the Vercel project, open **Settings → Functions → Function Region** (and any per-route `regions` config in `vercel.json` or route segment config). Record the region shown for the dashboard and API deployments.
2. In the DigitalOcean control panel, open the managed PostgreSQL cluster and record its **region** (for example `lon1` or `nyc1`), plus the connection hostname.
3. Confirm whether the database hostname resolves to the same region as the functions. A hostname alone is not proof; use the provider's region label.
4. Measure a representative round trip from a function in the deployed region to the database:
   - Run a simple `select 1` through the deployed app (for example a health or admin path that executes a query), or use the provider's connection test.
   - Record p50 and p95 over several samples, not one request.
5. Compare against the 129–283 ms baseline. If the regions differ, note the measured p50/p95 and whether it is within the baseline band or worse.
6. Check whether any Vercel route pins a different region, and whether cron/worker jobs run in yet another region.
7. Record the result below.

## Record

```text
Date: ______________________
Vercel function region(s): ______________________
DigitalOcean database region: ___________________
Connection hostname region label: _______________
Measured round trip p50: ________ ms
Measured round trip p95: ________ ms
Historical baseline: 129–283 ms
Same region? yes / no
Notes / follow-up: ______________________________
```

Do not change deployment configuration as part of this check. If the regions differ, raise it as a separate decision with the measured numbers.
