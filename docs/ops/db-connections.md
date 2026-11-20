# Database connection budget

The PostgreSQL client pool is created once per Node.js process. In serverless deployments, every warm function instance can hold its own pool, so a pool size that looks small locally can multiply quickly.

## Budget formula

Keep this inequality true for each environment:

```text
max concurrent function instances × DB_POOL_MAX
  + admin connections
  + worker connections
  + other application connections
  <= provider max_connections
```

Fill in the deployment-specific values before changing pool settings:

```text
Environment: ______________________________
Provider max_connections: __________________
Max concurrent function instances: __________
DB_POOL_MAX per instance: ___________________
Function connection budget: _________________
Admin connections reserved: _________________
Worker connections reserved: ________________
Other connections reserved: _________________
Total planned connections: __________________
Remaining headroom: _________________________
```

Do not use the provider's entire limit for function pools. Leave headroom for migrations, monitoring, maintenance, and unexpected traffic. These are planning values, not deployment defaults; no deployment configuration is changed by this document.

## Client settings

`packages/database/src/index.ts` accepts optional environment variables:

| Variable | Default | Meaning |
| --- | ---: | --- |
| `DB_POOL_MAX` | `10` | Maximum postgres.js connections in each process pool. This is deliberately unchanged unless explicitly configured. |
| `DB_IDLE_TIMEOUT` | `20` | Seconds before an idle connection is closed. |
| `DB_CONNECT_TIMEOUT` | `10` | Seconds to wait for a new connection. |
| `DB_PREPARE` | `false` | Whether postgres.js uses prepared statements. Keep `false` for transaction-mode poolers; only set `true` when the connection path supports prepared statements. |

The numeric settings must be positive integers and `DB_PREPARE` must be `true` or `false`; invalid values fail fast at startup. Settings are per process, not global across a deployment.

Before setting a non-default `DB_POOL_MAX`, calculate the total concurrent connection budget above using the actual instance concurrency limit and provider connection limit. Verify connection utilization and queue time under representative load; do not infer safe capacity from a single local process.
