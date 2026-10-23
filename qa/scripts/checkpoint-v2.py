"""Archive already-produced artifacts; do not build, launch, test, or publish."""
from pathlib import Path
import hashlib
import json
import shutil

root = Path.cwd()
feature = root / 'feature'
qa_repo = root / 'qa-repo'
candidate = root / 'restored/candidate'
assembled_qa = root / 'restored/qa'
downloads = root / 'downloads'
archive = qa_repo / 'qa/checkpoints/v2.0.0'
archive.mkdir(parents=True, exist_ok=True)

def copy_files(src, dst):
    for p in sorted(src.rglob('*')):
        if not p.is_file() or '.git' in p.relative_to(src).parts:
            continue
        q = dst / p.relative_to(src)
        q.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, q)

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

copy_files(candidate, feature)
manifest_path = feature / 'package.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
old_version = manifest['version']
manifest['version'] = '2.0.0'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

native = downloads / 'windows/candidate/pet/native/win-x64/KujiraPet.exe'
native_source = downloads / 'windows/qa/KujiraPet.cs'
if not native.is_file() or not native_source.is_file():
    raise RuntimeError('The already-compiled helper and its exact source are required for this checkpoint')
(feature / 'pet/native/win-x64').mkdir(parents=True, exist_ok=True)
shutil.copy2(native, feature / 'pet/native/win-x64/KujiraPet.exe')
shutil.copy2(native_source, feature / 'pet/native/KujiraPet.cs')

readme = feature / 'README.md'
notice = '> **2.0.0 开发检查点，未发布。** 本分支保存单只模型联动桌宠的进行中实现，Windows 原生窗口验证尚未通过，不是稳定安装推荐。请先读 [开发交接与任务清单](docs/development/V2_HANDOFF.md)。下文的 v1.6.2 安装地址仍指向旧的正式稳定版。\n\n'
readme.write_text(notice + readme.read_text(encoding='utf-8'), encoding='utf-8')
changelog = feature / 'CHANGELOG.md'
old = changelog.read_text(encoding='utf-8')
entry = '# 更新记录\n\n## 2.0.0（开发检查点，未发布）\n\n- 按用户指定，将单只模型联动桌宠升级目标改为 2.0.0。\n- 保存可选桌宠、插件设置、随模型换图、任务状态、DeepSeek 余额与 Codex 套餐接口的进行中实现。\n- 保存 15 套 SVG/PNG 草图与 Windows helper 源码/已编译程序；后者尚未通过窗口生命周期验证。\n- 已有 Web 成功结果、后续失败项、模拟数据边界和剩余任务见 docs/development/V2_HANDOFF.md。\n- 本次仅归档，不新增测试结论、不创建发行版、不更新市场。\n\n'
changelog.write_text(entry + old.removeprefix('# 更新记录\n').lstrip('\n'), encoding='utf-8')

# Keep actual candidate and the patched reconstruction helpers available after Actions expires.
shutil.copy2(downloads / 'source/candidate-source.tgz', archive / 'candidate-original-1.7.0-alpha.1.tgz')
copy_files(assembled_qa, archive / 'assembled-qa')

# Keep selected synthetic evidence, not raw request streams, tokens, or session launch logs.
for label, source, names in [
    ('web-passed-39958642948', downloads / 'web-passed', None),
    ('web-latest-39959578014', downloads / 'web-latest', ['ui-result.json', 'failure.png', 'failure-body.txt']),
    ('windows-latest-39959578014', downloads / 'windows/evidence', ['native-result.json']),
    ('unit-latest-39959578014', downloads / 'unit', ['unit-tests.txt']),
]:
    dst = archive / label
    dst.mkdir(parents=True, exist_ok=True)
    if names is None:
        names = [p.name for p in source.iterdir() if p.is_file() and (p.name[:2].isdigit() and p.suffix in ('.png', '.txt') or p.name == 'ui-result.json')]
    for name in names:
        p = source / name
        if not p.is_file():
            raise RuntimeError('Missing recorded evidence: ' + str(p))
        shutil.copy2(p, dst / name)

shutil.copy2(feature / 'docs/development/V2_HANDOFF.md', archive / 'HANDOFF.md')
facts = {
    'status': 'paused-development-checkpoint-not-a-release',
    'target_version': '2.0.0',
    'artifact_internal_version': old_version,
    'product_branch': 'feat/v2.0.0-single-model-pet',
    'qa_branch': 'qa/single-model-pet-20261023',
    'stable_base_commit': '6a9649612dc99ed8030aa5e961af42a37902598f',
    'candidate_qa_commit': '1538caee4d96fdd582637457c25dcdb83d41f349',
    'candidate_run': 39959578014,
    'previous_web_pass_run': 39958642948,
    'artifact_ids': {'source': 12504290949, 'unit': 12504710013, 'windows': 12504396170, 'latest_web': 12503813668, 'previous_passed_web': 12503631837},
    'candidate_source_archive_sha256': sha(archive / 'candidate-original-1.7.0-alpha.1.tgz'),
    'package_version_changed_only_for_checkpoint': True,
    'runtime_source_not_repaired_in_this_checkpoint': True,
    'tests_rerun_in_this_checkpoint': False,
    'source_assets': '14 model families plus unknown; original procedural SVG drafts and converted PNGs, not image-model output',
    'model_inference_and_account_values': 'synthetic fixtures in QA only; not real-account acceptance',
    'known_failures': ['latest Web run blocked by Preview Notice dialog', 'Windows: No visible process-owned Kujira HWND'],
    'feature_file_sha256': {},
}
for p in sorted(feature.rglob('*')):
    if p.is_file() and '.git' not in p.relative_to(feature).parts and p.name != 'V2_SNAPSHOT.json':
        facts['feature_file_sha256'][str(p.relative_to(feature))] = sha(p)
(feature / 'docs/development/V2_SNAPSHOT.json').write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(archive / 'SNAPSHOT.json').write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(archive / 'README.md').write_text('# 2.0.0 开发检查点证据\n\n参阅 [交接记录](HANDOFF.md) 与 [文件来源/摘要](SNAPSHOT.json)。\n\n- `web-passed-39958642948/`：上一轮 10 项 Web 场景通过的截图与原始结果（额度与推理为模拟）。\n- `web-latest-39959578014/`：最新 Web 首启弹窗阻塞的失败结果。\n- `windows-latest-39959578014/`：Windows 可见 HWND 未通过的结果。\n- `unit-latest-39959578014/`：已有单测输出，本次未重跑。\n- `assembled-qa/`：候选产物中实际经过转换的 QA 副本，仅供复现。\n- `candidate-original-1.7.0-alpha.1.tgz`：原始源码产物；旧试验版本号刻意保留以保持证据完整，产品接续版本为 2.0.0。\n\n这些文件仅保存在 QA 分支，不属于安装包。没有保存原始启动凭据或完整请求流。\n', encoding='utf-8')
# Remove only this one-time archival workflow. Existing QA workflows remain unchanged.
(qa_repo / '.github/workflows/pet-checkpoint.yml').unlink()
print(json.dumps({'archived_candidate_version': old_version, 'development_version': manifest['version'], 'product_files': len(facts['feature_file_sha256']), 'runtime_not_tested': True}, ensure_ascii=False))
