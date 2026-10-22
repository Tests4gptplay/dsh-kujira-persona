# 首次 npm 发布操作说明（维护者）

目标是让 DSH Desktop 的「插件 → 添加插件」支持直接输入：

```text
@tests4gptplay/dsh-kujira-persona
```

## 当前状态

- GitHub v1.3.1 Release 仍提供旧版未加 scope 的 `dsh-kujira-persona.tgz`，**不要覆盖原资产**。
- 分支 `feat/npm-scoped-package` 准备了 `@tests4gptplay/dsh-kujira-persona@1.3.2`、对应的 `cordis.patch.yml` 和 npm 公开发布配置。
- 截至 2026-10-22，CAH shot 可读取 npm Registry，但未登录 npmjs.com，也没有可用的 npm 发布密钥。因此 npm 正式发布尚未执行。
- npm Scope 并不是 GitHub Scope：`@tests4gptplay` 必须归实际有发布权限的 npm 用户或组织所有。如果 npm 用户名不同，请**先更新** `package.json`、`cordis.patch.yml` 和安装文档，不要发布到别人名下。

## 第一次发布（需要 npm 账号持有人操作）

1. 在 https://www.npmjs.com/ 登录或创建自己控制的账户，确保拥有 `tests4gptplay` Scope；开启 2FA。
2. 在已安装 Node.js 22.14+/npm 11.15+ 的本机终端运行 `npm login --registry=https://registry.npmjs.org/`，再运行 `npm whoami` 确认账号。**不要把 npm 密码、令牌或 2FA 代码发送到聊天中。**
3. 将本发布准备分支签出到本地，并确认工作树只包含预期的发布材料。

   ```bash
   git clone https://github.com/Tests4gptplay/dsh-kujira-persona.git
   cd dsh-kujira-persona
   git checkout feat/npm-scoped-package
   npm pack --ignore-scripts --dry-run --json
   ```

4. 使用 npm 的分阶段发布流程；第一次创建新包也受支持：

   ```bash
   npm stage publish --access public
   npm stage list '@tests4gptplay/dsh-kujira-persona'
   ```

5. 在 npmjs.com 的待审批列表审查并批准本次 Stage（需 2FA），或使用 `npm stage approve <stage-id>` 进行交互式批准。**仅提交 Stage 并不等于用户已可安装**；须等 Stage 获批准。

6. 验证发布结果：

   ```bash
   npm view '@tests4gptplay/dsh-kujira-persona' version --registry https://registry.npmjs.org
   npm view '@tests4gptplay/dsh-kujira-persona' dist.tarball --registry https://registry.npmjs.org
   ```

   用干净目录执行 `npm install '@tests4gptplay/dsh-kujira-persona'`，核对 `node_modules/@tests4gptplay/dsh-kujira-persona/cordis.patch.yml` 和人设文件，最好再在 DSH Desktop 中通过「添加插件」输入包名，加载后执行 `/persona` 进行真实端到端验证。

## 后续版本的 GitHub Actions 发布（可选）

首次发布成功后，将准备分支合并回 `main`，在 npm 网站打开该 package 的 Settings → Trusted Publisher，并配置：

| 项目 | 值 |
| --- | --- |
| Provider | GitHub Actions |
| User / Organization | `Tests4gptplay` |
| Repository | `dsh-kujira-persona` |
| Workflow filename | `npm-publish.yml` |
| GitHub environment | 留空 |
| Permission | 允许 `npm stage publish`，无需开放直接发布 |

仓库预置的 `.github/workflows/npm-publish.yml` 使用 GitHub-hosted `ubuntu-latest` 和 OIDC（`id-token: write`），不支持在 `cah-shot` 等 self-hosted Runner 上以 OIDC 发布。需要注意 npm Trusted Publisher 配置首次验证有 48 小时时限；应在工作流可运行时再配置。

后续版本更新 `package.json` 版本号后，可通过 Actions 手动启动工作流，将包送入 Stage，再由 npm 维护者批准。**不需要在仓库中保存 npm 密码或长效 Token。**

## 最终收尾

npm 的 `1.3.2` 版本**实际可安装**后，才应把默认分支 README 的「准备中」替换成正式的 npm 安装说明，并将 GitHub Release 提供的新旧版本、Awesome DSH Plugin 的 tarball 条目分别核对。原来的 `v1.3.1` tarball 属于 unscoped 包，不等同于新的 npm scoped 包；不要无验证地覆盖它。

