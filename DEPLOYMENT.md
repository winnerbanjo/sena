# Sena Release & Deployment Runbook

## Core Philosophy
**Build → Test → Push → Approve PR → Deploy Automatically**

Sena uses continuous deployment via Vercel tied to the `main` branch. Merging an approved Pull Request into `main` automatically builds and deploys `app.sena.ng` and `admin.sena.ng`.

---

## 1. Normal Feature Release Workflow

### Step 1: Branch & Build
Always develop features on a dedicated branch from `main`:
```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### Step 2: Local Verification
Run automated tests and typechecks locally before creating a PR:
```bash
pnpm check-types
pnpm lint
pnpm build
```

### Step 3: Create Pull Request
Push your branch and open a PR against `main`:
```bash
git push -u origin feat/your-feature-name
gh pr create --fill
```
- GitHub Actions CI runs typecheck, linting, and build validation automatically.
- Vercel generates an isolated preview deployment.

### Step 4: Database Migrations (If Schema Changes Exist)
Follow the **Expand & Contract** principle:
1. Schema changes must be **additive** (new nullable columns, new tables, or columns with safe defaults).
2. Run preflight verification:
   ```bash
   DATABASE_URL="<PROD_URL>" pnpm db:preflight
   ```
3. Apply migration to production **BEFORE** merging the PR so the new database schema is in place when the application deploys:
   ```bash
   DATABASE_URL="<PROD_URL>" pnpm --filter @sena/database db:apply-<migration-name>
   ```

### Step 5: Merge & Auto-Deploy
Once CI is green and schema changes are applied:
1. Approve and merge the PR to `main` (Squash & Merge recommended).
2. Vercel automatically deploys the new release to production.
3. Verify live status via the health check:
   ```bash
   curl -s https://app.sena.ng/api/health
   ```

---

## 2. Emergency Hotfix Workflow

When an urgent production bug arises:

1. **Branch directly from `main`**:
   ```bash
   git checkout main && git pull origin main
   git checkout -b hotfix/issue-description
   ```
2. **Implement & Test Fix**:
   - Keep changes strictly targeted to the bug.
   - For database migrations, enforce safety timeouts (`lock_timeout = '2s'`, `statement_timeout = '5s'`) to prevent table locking.
3. **Push & Create PR**:
   ```bash
   git push -u origin hotfix/issue-description
   gh pr create --title "hotfix: issue description" --body "P0 Hotfix details"
   ```
4. **Preflight & Apply Migration**:
   - Verify cluster recovery point in DigitalOcean.
   - Run `pnpm db:preflight`.
   - Apply migration with strict TLS.
5. **Merge PR & Monitor Vercel**:
   - Merge PR to `main`.
   - Track Vercel deployment status to `Ready`.
   - Perform safe, read-only smoke tests on live endpoints.

---

## 3. Database Safety & Migration Guardrails

- **Zero Data Loss Rule**: Never drop existing columns, reset tables, or run destructive DDL on production.
- **Lock Protection**: All DDL executed against production MUST set:
  ```sql
  SET LOCAL lock_timeout = '2s';
  SET LOCAL statement_timeout = '10s';
  ```
- **TLS Verification**: Remote connections to DigitalOcean PostgreSQL must use TLS verification (`rejectUnauthorized: true`).
- **Credential Hygiene**: Never commit `.env` files, echo database URLs in terminal logs, or share passwords in chat.

---

## 4. Rollback Procedures

### Application Rollback (Instant)
If a faulty deployment causes errors on `app.sena.ng`:
1. Open the [Vercel Dashboard](https://vercel.com).
2. Navigate to **Deployments**.
3. Locate the previous stable production deployment.
4. Click **Instant Rollback** / **Redeploy to Production**.
*(Vercel switches edge routing in under 15 seconds).*

### Database Rollback Safety
- **DO NOT** execute `DROP COLUMN` during an emergency rollback.
- Because migrations are additive, reverting application code to the prior version continues functioning seamlessly while ignoring the new columns.

---

## 5. Founder Release Checklist

- [ ] All feature code committed and pushed to dedicated branch.
- [ ] GitHub CI checks are green (Typecheck, Lint, Build).
- [ ] DigitalOcean backup / recovery point verified in console.
- [ ] Database preflight executed (no active locks, compatible constraints).
- [ ] Additive migration applied with safety timeouts.
- [ ] PR merged to `main`.
- [ ] Vercel deployment reports `Ready`.
- [ ] `https://app.sena.ng/api/health` returns HTTP 200 `status: ok`.
- [ ] Non-destructive smoke test passed on live UI.
