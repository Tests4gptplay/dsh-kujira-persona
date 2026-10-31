# Account query correction: evidence and validation

Candidate installation source: `https://github.com/Tests4gptplay/dsh-kujira-persona/tree/fix/account-query-20261031`

Base: `09561de8676b469b81e79fc663b4f3f53e9b7f4b`; candidate version `2.4.1-account.20261031.1`. Scope: account query adapters and existing account information area only. This is a candidate, not a stable release or marketplace publication.

## Official contracts mapped to changes

- [OpenAI Costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs): `GET /v1/organization/costs`, `data[].results[].amount.value/currency` → monetary **spend**, not remaining credit. [Completions usage](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions): `GET /v1/organization/usage/completions`, input/output tokens → **Completions usage**, not all-product usage or money. Existing UTC calendar-month start and organization/project scope retained. Both appear in the original account area. [Administration](https://developers.openai.com/api/reference/administration/overview) requires administration query credentials distinct from inference credentials. Missing/unauthorized credentials have a specific purpose label; no new key provisioning required by this patch. No public remaining-credit endpoint was established; no token/cost estimate is substituted for balance.
- [Mistral official OpenAPI](https://docs.mistral.ai/openapi.yaml): `/v1/admin/spend-limit` `limits.completion.no_monthly_limit` is optional with default false; undefined now follows that default. Currency and nullable money remain validated, not converted to zero. Official `AdminApiKey` bearer authorization retained. `usage_limit - total_usage` remains clearly an organization **budget** remainder, not prepaid credit. Source snapshot SHA256: `08a585fb75bcfa6ff968773134ee00060e0db283fc6b16f421f544e78ba8db92`.
- [Alibaba QueryAccountBalance](https://help.aliyun.com/en/user-center/developer-reference/api-bssopenapi-2017-12-14-queryaccountbalance): HTTP400 `Code` in `NotAuthorized`, `NoPermission`, `AuthSiteFail` → permission-needed, rather than generic query error. Other HTTP400 codes remain errors. Existing signed AK/SK credentials and official currency/available balance mapping are retained. Response text is not exposed.
- [Volcengine official QueryBalanceAcct SDK](https://github.com/volcengine/volcengine-go-sdk/blob/master/service/billing/api_query_balance_acct.go): `Result.AvailableBalance` plus `Result.Currency` → balance amount and server currency. Currency configuration becomes optional fallback only when response currency is absent; response currency wins on conflict. Existing signed AK/SK and optional STS reference remain available. Signing region is not changed without definitive evidence.
- [GLM official usage plugin](https://docs.z.ai/devpack/extension/usage-query-plugin): `TOKENS_LIMIT` is the five-hour coding quota; `TIME_LIMIT` monthly MCP quota. Existing percentage-used semantics retained; explicit period labels added. Official implementation reviewed at `0446d0bb0bc537d97d3ab3664c4b8b9c4a0e1254` in `zai-org/zai-coding-plugins`, `plugins/glm-plan-usage/skills/usage-query-skill/scripts/query-usage.mjs`.
- [Ark GetAfpUsage](https://docs.volcengine.com/docs/ark/get-afp-usage-api?lang=zh): rolling one-day/week/month windows labeled as rolling, not calendar periods; official remaining quota ratios remain unchanged.

No speculative new provider endpoints, undocumented web billing APIs, or credential reads were added. Existing explicit proxy origin rules and redirect restrictions remain intact. No changes to user dossiers, diaries, native binaries, or DSS.

## Reproducible checks

Cloud Linux; Node v24.22.1, npm 11.9.0. Commands run in dot's own cloud workspace, not the user's machine. `fs-native-extensions@1.5.1` and its dependencies installed from npm with install scripts disabled. No account credentials or paid calls used.

1. New official-contract tests against base: query suite 4 pass / 7 fail; cloud suite 1 pass / 7 fail. All fixture credentials and amounts are synthetic.
2. Modified contract suites: **19 pass / 0 fail**, including real `Response` objects, missing permission/no-fetch, official request path/month/project fields, partial failure versus legitimate zero, malformed values, optional boolean, currency precedence, STS optional field preservation, and period labels. English projection of visible OpenAI metrics also asserted.
3. Existing multi-session bubble checks: **10 pass / 0 fail**.
4. Broader existing suite (`node --test --test-reporter=tap *.test.js scripts/qa/*.test.mjs`): baseline **152 pass / 18 fail / 2 skipped**; modified **171 pass / 18 fail / 2 skipped**. The 18 failing test names are identical. This is NOT an all-green repository result; pre-existing diary/native/disposal/dossier/sprite fixture failures remain outside this account-query patch. Initial dependency-free failures were resolved by installing the declared dependency before this comparison.
5. `node --check` on all six modified runtime files and `git diff --check` pass.
6. `npm pack --ignore-scripts` produces an actual candidate package, installed into a clean cloud prefix using npm with scripts disabled. The 19 contract tests are rerun against that installed runtime via `KUJIRA_PACKAGE_ROOT`; package `index.js` import smoke test is separate from live host UI acceptance. QA fixtures are not runtime package contents.

Reproduce the focused source tests:

```sh
node --test scripts/qa/account-query-contract.test.mjs scripts/qa/account-cloud-contract.test.mjs
```

Reproduce against an installed candidate (absolute root, not a credential):

```sh
KUJIRA_PACKAGE_ROOT=/absolute/path/node_modules/dsh-kujira-persona node --test scripts/qa/account-query-contract.test.mjs scripts/qa/account-cloud-contract.test.mjs
```

## Acceptance boundary

Contract fixtures establish parser/request/UI-model behavior, not the user's actual balance or provider access. Package install/import checks establish shipped runtime packaging, not a running DSH desktop acceptance or a real-account billing integration. No real account query, screenshots of changed live UI, main merge, stable release, or marketplace deployment is claimed. The original screenshot established a permission-configuration prompt; it did not establish zero balance, successful query, or query correctness.

## Candidate .2: reachable configuration versus API existence

The actual Kujira settings entry is Settings → Kujira · Personas → Account & model pricing (collapsed details; requires a selected provider/model). `pet/client.js` registers `settings.section`, renders `AccountSettings`, and saves `usageProfiles[provider].credentialRef`. This field stores a reference name only, not a secret. The bubble has no credential entry button.

Host evidence is pinned to [deepseek-harness ce7073d](https://github.com/deepseek-ai/deepseek-harness/tree/ce7073d51254c26cd63b22a60835b8f948deb447):

- [credentials-local implementation](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/credentials/credentials-local/src/index.ts) resolves stored references first, inherited process environment next, then invocation/home dotenv sources. This is implementation capability, not proof of the user's installed host or launcher environment.
- [Models UI documentation](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-settings-models/README.md) edits the model profile API key; it is not evidence of a separate Admin-query credential entry. Do not replace an inference key with an admin key to work around this gap.
- [Credentials controller](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/api/settings-controller/src/credentials.ts) has describe/set methods, but Kujira has not implemented a dedicated admin secret input using them. An API seam is not a finished UI.

Consequently, missing or unresolved OpenAI admin references now show unsupported-in-this-setup, without telling the user to configure a nonexistent input. Existing working references still use official cost/usage endpoints. HTTP401/403 remains a distinct invalid/insufficient-permission result. No new secret input, storage, read surface, or user-machine action was introduced. The settings text explains its limited reference-linking function. English and Chinese copies agree.

Candidate .2 focused fixture suite: 22 tests (19 retained + unresolved reference + remote401 + remote403), no live account calls. Earlier full-suite counts above describe candidate .1, not a new claim of full-suite acceptance for .2.
