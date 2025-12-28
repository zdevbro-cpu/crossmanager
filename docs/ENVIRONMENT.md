# Environment File Guide

This repo uses Vite + Node. Vite reads environment variables in this order:
1) `.env`
2) `.env.local`
3) `.env.[mode]`
4) `.env.[mode].local`

For production builds, use `--mode production` and make sure local-only files
are not present on the build host.

## Root / Server

- `.env.cross.local`: shared DB credentials for local/dev use.
- `server/.env`: server runtime defaults (used when `server/env_customer.env` is absent).
- `server/env_customer.env`: customer override (loaded first when present).
- `functions/.env`: Firebase Functions / Cloud SQL config.

## Frontend Modules (Portal / pms / ems / sms / swms)

Standard layout:
- `.env`: shared, non-secret defaults (API base, portal login URL).
- `.env.local`: local dev config (Firebase dev project keys).
- `.env.production`: production config (Firebase prod project keys + API base).

Optional:
- `pms/.env.development.local`: local proxy target override for dev.

## Notes

- `*.env.local` should not be used in production builds.
- Non-standard `*.env_dev` files are deprecated; prefer `.env.development.local`.
