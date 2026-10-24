# Move wasl-hrms to MongoDB

Opened by DevX Control after the data was copied into **db / wasl_hrms**.

## What changed
- .env.example: MONGO_URI now shows a MongoDB connection string placeholder.
- docker-compose.yml: mongo: now starts only with --profile local-db.

## Needs a person
- Nothing flagged automatically.
- [ ] Look through any code that treats ids as numbers (parseInt of an id, z.number() ids).
- [ ] Run the tests and click through the app against a MongoDB database before merging.

## Check run by DevX Control
- No schema check was needed.

## Deploying
1. Put the real connection string in the server's `.env` as `MONGO_URI` (never commit it).
2. Merge this pull request, then pull in DevX Control. It points the app at MongoDB, runs its checks, and only then offers to remove the old database.
