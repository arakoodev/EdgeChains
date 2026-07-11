# Loom recording script (about 60–90 seconds)

1. Show issue #290 and the three completion requirements.
2. Open `src/index.ts` and point out `of(input).pipe(redactor.endpointOperator(endpoint))`.
3. Run `npm run demo` without AWS credentials and show that the endpoint receives `[EMAIL]` and
   `[PHONE]`, not the original PII.
4. Show the RxJS tests for ordering, completion, errors, and cancellation.
5. Run the focused test command and show it passing.
6. Optionally set `USE_REAL_AWS=true` and repeat using a least-privilege AWS profile.
7. Paste the Loom URL into the PR description before requesting review.
