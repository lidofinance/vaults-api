## Lido Vaults API

The service is responsible for fetching and aggregating Lido Staking Vaults data:
- Fetches vaults and reports from on-chain contracts and IPFS
- Calculates vault metrics based on on-chain and IPFS data
- Stores all processed data in PostgreSQL

It operates in two modes:
- API — exposes data to external consumers and frontend applications
- Worker — runs scheduled tasks for fetching reports, updating vault data, and recalculating metrics

### Prerequisites

- Node.js v24+
- PostgreSQL v15+
- Yarn package manager v1

This project requires an .env file which is distributed via private communication channels. A sample can be found in .env.example

### Development

Step 1. Copy the contents of `.env.example` to `.env`

```bash
cp sample.env .env
```

Step 2. Fill out the `.env`.

Step 3. Install dependencies

```bash
yarn install
```

Step 4. Build the APP and apply DB migrations

```bash
yarn build
yarn typeorm:migration:run
```

Step 5.1. Start the API
```bash
yarn start:dev
```

Step 5.2. Start the Worker
```bash
yarn start:worker:dev
```


Or just run on the Docker
```bash
docker-compose down -v && docker-compose build --no-cache && docker-compose up --force-recreate
```

### Production

Start the API
```bash
yarn build && yarn start:prod
```

Start the Worker
```bash
yarn build && yarn start:worker
```

### E2E tests

Test characteristics:

- Controllers are tested in isolation.
- All external dependencies (database, contracts, IPFS, cron logic) are mocked.
- No real network, blockchain, or database access is required.
- Tests do not depend on environment variables.

E2E tests are fully self-contained and can be executed without an .env file:

```bash
yarn test:e2e
yarn test:e2e:coverage
```

### Automatic versioning

Note! This repo uses automatic versioning, please follow the [commit message conventions](https://www.conventionalcommits.org/en/v1.0.0/).

e.g.

```
git commit -m "fix: a bug in calculation"
git commit -m "feat: dark theme"
```

### Release flow

To create a new release:

1. Merge all changes to the `main` branch.
2. After the merge, the `Prepare release draft` action will run automatically. When the action is complete, a release draft is created.
3. When you need to release, go to Repo → Releases.
4. Publish the desired release draft manually by clicking the edit button - this release is now the `Latest Published`.
5. After publication, the action to create a release bump will be triggered automatically.

Learn more about [App Release Flow](https://www.notion.so/App-Release-Flow-f8a3484deecb40cb9d8da4d82c1afe96).
