# Selected-session task state

## Baseline

Fix base: `b2eedeab5fae3529a8ec54b14c5242332912a94e` (`feat/v2.0.0-single-model-pet`, package 2.0.1). The affected `pet/client.js`, `pet/controller.js`, and `pet/index.js` blobs are identical to published v2.0.0 / main `fcf7fee07e3507cfe62c331c42aa3cc8bf8a732f`. Version, artwork, prompts, and persona content are unchanged. This branch is not a release.

## Defects verified

- The controller remembered only events seen while enabled. DSH does not republish seeded history on `session/event`. Selecting an already-running session without a later event therefore returned the empty task. Statistics were hidden by the idle phase; cold sessions also lacked the synchronous live-store statistics lookup.
- The model follower used every mounted `conversation.input.overlay`, rather than the current main binding. DSH's embedded subagent sidebar can mount another conversation/composer concurrently. Its focus/visibility listener could select the background session.
- Explicitly selected delegated sessions were excluded by the blanket subagent event filter.

A controlled reproduction uses a first session emitting live assistant frames and a second already-running session with no new event after selection. The unchanged runtime fails the second-session active assertion; the fixed runtime passes. This establishes the code defect, not a diagnosis from private production logs or a GUI recording.

## Fix

The client gates each overlay on the public `uiSession.adapter.current` binding and rechecks its key inside focus/visibility handlers. Empty main selection clears the route, including the first frame after SSE reconnection.

The host observes the selected session through `sessionQuery.observeSession()`, disposes every lease, and folds only presentation fields. The initial read covers the session's own history; subsequent reads use the sequence cursor and do not materialize event history when unchanged. Selected-session statistics can come from that exact observation when no live session is present. There is no new polling loop.

Events arriving during an observation are retained only as presentation discriminants and merged by sequence. Later turn/status changes, session disposal, disabling, and newer selections cannot be overwritten by an old observation. Live driver status prevents an orphaned open log from claiming ongoing work. Already-observed streams retain their activity; a hydrated active stream can join its next chunk without waiting for a new attempt-start frame.

Unselected delegated sessions cannot take the foreground. An explicitly selected delegated session can hydrate and receive its own events.

## Verified APIs

Source inspection covered DSH 0.2.1-rc.2 (`d1b9c0406783051f53587719372489aa0a9d76ac`) and 0.2.1-rc.3 (`22ddee3792402c3e70ec5f86a63c3e3e895a2f60`):

- `packages/client/ui-session/src/client/index.ts`: public adapter/current binding and main-view publication.
- `packages/client/ui-subagent/src/client/sidebar-chat/index.tsx`: simultaneous embedded conversation/composer.
- `packages/core/session/src/index.ts`: seed events do not emit live notifications; live-store lookup.
- `packages/session-query/session-query/src/observation.ts`: live/prepared observation, cursor, projections, and disposal.
- `packages/core/agent/src/runtime-types.ts`: public idle/running status and status events.

No private navigation fields or backend-specific model account APIs are used.

## Checks

Dependency-free lanes:

```sh
node --test scripts/qa/state-routing-check.mjs scripts/qa/multisession-bubble-check.mjs \
  scripts/qa/selected-session-hydration-check.mjs scripts/qa/selected-session-adapter-check.mjs \
  scripts/qa/selected-session-client-check.mjs
node scripts/qa/state-art-check.mjs
node scripts/qa/minimax-response-inbetween-check.mjs
```

The optional SDK integration lane uses an isolated installation of `@deepseek-ai/dsh-session`, `dsh-session-query`, `dsh-session-projection`, and `dsh-session-stats`, all at `0.2.1-rc.2` (Cordis 4.0.5). It imports the released modules; it does not launch a model provider.

```sh
DSH_TEST_ROOT=/absolute/path/to/isolated-sdk-install \
  node --test scripts/qa/selected-session-sdk-check.mjs
```

Baseline comparison accepts `PET_CONTROLLER`, `PET_CLIENT`, and `PET_INDEX` overrides in the new checks. Use an absolute `file://` module URL for the controller/index overrides.

Verified: 2/3/10/50 sessions, hundreds of rapid returns, current model and statistics, waiting/approval, completion/cancel, stale and duplicate sequences, pending-read races, A/B/C out-of-order completion, explicit selected child, enable/disable, stream joining, empty selection, SSE reconnection, stable terminal signals, and success/error pulse identity when live events race initial hydration. The HTTP/observation adapter lane checks 150 selections over 50 sessions, only 50 initial event materializations, and disposal of all 150 leases.

The real SDK lane uses actual `Session.append`, Cordis scoped/global dispatch, `SessionQuery`, and session-stat projections across 50 live sessions and 100 switches. Agent status values are controlled fixtures. The unchanged plugin fails this same lane; the fixed plugin passes.

All 59 checks passed in the isolated Linux workspace. Tests, source investigation, downloaded dependencies, and this document are excluded from the install package. No browser GUI playback, complete DSH profile/model-provider run, or native Windows smoke was performed in this pass.
