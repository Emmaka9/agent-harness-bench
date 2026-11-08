Token-Bucket Rate Limiter

Create `src/limiter.js` exporting a single named ESM class, `TokenBucketLimiter`: an in-memory, per-key token-bucket rate limiter. Node.js builtins only, no external packages. ESM.

Constructor — `new TokenBucketLimiter(options)` with `options = {rate, burst, now}`:
- `rate`: required finite number > 0; tokens added per millisecond is exactly `rate / 1000`.
- `burst`: required finite number > 0; a bucket never holds more than `burst` tokens.
- `now`: optional function returning the current time in milliseconds; defaults to `Date.now`.
Validation runs in the order rate, then burst, then now, and throws a `TypeError` with exactly one of these messages: `"rate must be a finite number > 0"`, `"burst must be a finite number > 0"`, `"now must be a function or undefined"`.

Each key has a bucket created lazily on first use, holding `{tokens, lastMs}`. A new bucket starts with `tokens = burst` and `lastMs = now()`, created at the moment it is first needed. Refill applies the formula with whatever `elapsed` it computes, including a negative one (no floor at zero); the cap is always applied.

`allow(key, cost = 1)`: resolves the key's bucket, then computes `elapsed = now() - lastMs` and refills: `tokens = Math.min(burst, tokens + elapsed * rate / 1000)`, then sets `lastMs = now()`. If `cost > burst` it throws a `RangeError` with the message `"cost exceeds burst"`; this check happens before any state is read or changed, so the bucket is neither created nor updated when it throws. If `tokens >= cost`, deduct: `tokens = tokens - cost` and return `true`; otherwise return `false` with `tokens` left at the refilled value.

`retryAfterMs(key, cost = 1)`: with the bucket refilled exactly as in `allow` (the check and throw for `cost > burst` apply here too, also before any state change), if `tokens >= cost` return `0`. Otherwise return `(cost - tokens) * 1000 / rate`. `retryAfterMs` never deducts tokens and never stores state: it neither creates a bucket for a key that has none (returning `0`, since a fresh bucket always has `tokens = burst >= cost`) nor updates an existing bucket's `lastMs` or `tokens`.

`now()` is evaluated exactly as follows: an `allow` that creates a bucket evaluates it twice (creation timestamp, then refill); an `allow` on an existing bucket, and a `retryAfterMs` on an existing bucket, evaluate it exactly once; a `retryAfterMs` on a key with no bucket evaluates it zero times. Nothing else evaluates `now()`.

The `cost` argument of `allow` and `retryAfterMs` is never validated beyond the `cost > burst` check above, and nothing else throws: a non-number or negative `cost` is just used in the formulas as written, and any value is accepted as a key. Keys use Map key semantics (SameValueZero); non-integer keys and costs are not special-cased.
