# Pet context menu and visible-content bounds

Validated development snapshot: `335165f3cb95cd908fd16540137eb29fd0930c22`. Release 2.0.3 carries the same production source and verified native executable onto main, with version and release documentation updated separately.

## Baseline and scope

Based on `8ef2774f834a185a9b72e9a5b372b8a340e98a9d` (2.0.2).
The cloud working snapshot was checked against every blob in that commit before editing.
No sprite atlases, animation manifests, session controller/reducer, persona files or prompt files are changed.

## Behavior

- Exactly three menu actions: show/hide the pet, show/hide the bubble, close both.
- `enabled` remains the companion-wide switch, not the persona plugin switch.
- `showPet` defaults to true for old configurations and is also exposed in settings.
- `bubble` remains the existing always/tasks/hidden setting; `bubbleBeforeHidden` retains the last non-hidden policy.
- When both are hidden, no transparent drag handle remains. Settings can restore either surface.
- Hidden sprites are unmounted on the web and collapsed/non-hit-testable in WPF. Their size is excluded from layout.
- Both visible surfaces support dragging. Bubble-only bounds use the measured bubble, including scale/content changes.
- Long bubbles scroll within available viewport/work-area height. Restoring the sprite clamps placement to legal bounds.
- Native frame scheduling pauses while the sprite is hidden; selected-session state and bubble content continue updating.

## DSH UI integration

The web client directly uses the public `Menu` from `@deepseek-ai/dsh-client-ui-primitives`.
It is a static shared module in the DSH web seed, not an additional plugin injection dependency.
The Menu owns portal placement, viewport fit, Escape and outside dismissal; its owner closes it on selection.
The existing menu styling inherits the host's `--dsw-*` variables.
These APIs were checked in DSH rc.2 and rc.3 source, without adding a host-version gate.

Windows is WPF, not React: the native menu retains WPF ContextMenu/MenuItem controls. A minimal token-bound MenuItem visual
(Border plus header presenter) avoids the default Aero template's hard-coded blue hover fill;
keyboard/click behavior remains with MenuItem.
A small palette bridge reads the resolved public DSH menu tokens after theme application and sends opaque
colors through the existing connection and native stdin transport. This is theme synchronization,
not cross-platform reuse of the React component. Alpha colors are composited over DSH's base background.
Body theme attribute changes, public `theme/change`, visibility restoration and SSE reconnection refresh the palette.
The five-color payload is presentation-only and not persisted to user settings.

## Validation layers

- Node regression suite includes selected-session SDK/adapter/hydration/client regressions and menu/layout component harnesses.
- `native-visibility-source-check.mjs` is only a source contract; it is not Windows runtime evidence.
- `verify-native.ps1` builds the product and separate protocol/visibility WPF harnesses on GitHub-hosted Windows.
  Only the clean product executable is eligible for the runtime package; harness source/executables stay out.
- The development workflow has read-only repository permissions and uploads artifacts. It does not publish releases,
  update main, invoke a user machine, or install the plugin.
- Browser fixture checks, if run, validate actual React/DSH Menu with controlled host interfaces, not a complete DSH installation.

The real React/DSH Menu rc.2 browser fixture passed at commit `1c884a81a8431f9f6ba0f7da04ae4f1e2e8ba870`,
including 150px-tall viewport restoration and palette re-send after reconnect.
Windows CI exposed stale multiline measurement and the Aero hover override; regression assertions
were retained while addressing these findings. See the exact commit's CI results for final executed checks. Human desktop interaction and a full DSH host session are separate
from the automated component/WPF harness coverage and must not be represented as verified by source checks alone.

## Native build receipt

`PET_CONTEXT_MENU_NATIVE_BUILD.json` binds the shipped development EXE to its passing Windows run,
Git source blob, exact compiled-source hash (Windows CRLF checkout), executable hash and artifact.
At source commit `6a29df4717279c84f6930e441b5ba02bff964679`, the actual WPF highlighted Border was
verified as the supplied DSH color, and multiline/scaled/long-scrollable bubble geometry passed.
A later binary-only commit does not require replacing this verified EXE with a compiler timestamp variant.
