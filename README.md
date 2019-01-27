# rx-cache

**IMPORTANT** IN DEVELOPING NOW. DON'T USE.

A cache module for async task based on rx.

> In fact, it's not complete now. Considering...

## background

When we do some async tasks, we'll meet some situations, such as duplicate tasks, the result management/share of task and error.

We want to share some results of async tasks, such as userInfo or some dictionaries, instead of another request.

We want to handle errors using better ways, e.g. retry when error.

We want to force update async results when we need.

We want to use interceptors.

We want to normalize these...

## now?

For results sharing, we can use a store to do this.

For error handling, we can use `Promise#catch/onRejected`.

For forceUpdating, we can reload data and replace the state in store.

For interceptors, we can set different interceptors in different situations.

For retry, hard to implement an elegant way...

In a word, we can use Promise and a store to achive some. But... not elegant.

## Rx?

Rx is lodash for async/stream.

We can use ReplaySubject/catchError/retry or even scan(to make a store) to do these things.

TODO

## reactive

The code in `reactive` directory is previous trial in dev. Will improve later :D.
