# 美术源链进度检查点 — 2026-10-25

## 范围与状态
基于 `feat/v2.0.0-single-model-pet` 的 `b2eedeab5fae3529a8ec54b14c5242332912a94e` 建立独立美术工作分支。此文件只是非发布进度索引，不变更生产资源、运行时代码、安装包清单或版本，不代表验收。

所有下列新素材仍为源级研究或内部候选，**未验收**。静帧、文件哈希或时序检查不能替代实时播放和审美验收。旧 GPT 衣服/空间扭曲候选不恢复为通过状态。运行环境的实播验证仍受阻；没有以绕过环境限制或改变安全设置的方式继续测试。

## 当前已知缺陷
- GPT：当前新源链有 16 项内部序列；更正了旧视频导出中部分 +20ms 量化误差。精确导出不是动态质量通过证明，仍需检查转掌、指缘软硬及整段节奏。
- MiniMax：源、骨架与反馈分阶段保留；大展示端姿手型有歧义待修，过渡缺口不能用骨架总时长掩盖。
- Claude：保留真 point-release 源、静区和来源溯源；旧 cuff 微修及新半开试验被拒。旧 release 的 closed-book 标签已过时，实际原图为打开书。没有通过的新动画。
- 豆包：round8 为原状态中局部 1→2 缺口的单 native 子点及 13 源研究，不能称完整 commanding；还须接回状态原始首尾。旧 end 仅空间中点，不等于真实开掌阶段修复。
- MiMo：原生采样修正与旧 320 尺度脸软失败实验分开保存。静帧有限复审不代表动态验收。

## 冻结恢复资料索引
下表为离线恢复包的准确文件名及 SHA256。它们不随插件安装，不在此分支重复上传素材。恢复时按依赖先后取包并核验摘要；名称相近不代表可互换。

| 文件 | SHA256 | 依赖/用途 |
|---|---|---|
| GPT_kinematic_three_sources_checkpoint.zip | d073020d696f46dcc1ec0c93daa5d9ebb55de7559d04d6ddb94c1c635abd3959 | 新三真源基础 |
| GPT_kinematic_midpoint_trial_checkpoint.zip | 7692955261e014a7ef1c0b8c0a694ae21b2d50ac0f353e31aa1b8f02e6f0239d | 三真源；包含拒收点和新源 |
| GPT_five_true_source_loop_checkpoint.zip | 7cc5054680b7d63df0b07025c4383fcc01646c5cbc2a8e41315dfe3ddc37f736 | 三源和 midpoint |
| GPT_single_MB_native_loop_increment.zip | 20183613424ce668fe2c5e29f24f344426c153e21b882b3428e7be258ae88cc4 | 五真源 |
| GPT_native_16item_loop_increment.zip | 3fdf65037f84db08ef399ce9337a0049aa6a46ad7c95e9d9e80cb38bb9166495 | MB 及前链 |
| GPT_16item_exact_video_review_addendum.zip | 0162e2777523f44a451bd86a56d18a8bf291963b5e22f786a7639c68e8ace12d | 16项；精确导出和复审附录 |
| Kujira_v7_A05_true_keys_INTERIM_CHECKPOINT.zip | 646487140077a016b9053e7a5de02e1a753e46eb1595174f7def1f45bf261efb | front-source/r3 前链；依赖全摘要在包内 |
| Kujira_v7_skeleton_r4_INTERNAL_ADDENDUM.zip | e9b4c3789e5e08fe9626328fdcb214b71e8f8d4ed68fa1227fc992a152c74a8d | A05 |
| Kujira_v7_large_source_feedback_INTERIM.zip | 12b4e35e1daed52f5ab8a1d0577a6fc3154923bd227d1ac0d07c61b5693286bd | r4 附录 |
| Claude_true_point_release_source_checkpoint.zip | 1c37acca98ec8e665a69e446eb30fa0e26fa938af54399fe7ed4556672f5247b | 当前固定源重组自包含 |
| Claude_source_provenance_and_rejected_trials_addendum.zip | db9377ac890eb0d11ed2c74296cbf7ea7cf7473e28516c8f776d15e6f0b0996f | Claude 来源更正与拒收记录 |
| Kujira_C_round5_frozen_source_recovery_20261025.zip | 3a4d6df675f3c068e597e4d80067ee6fe6d63b1298e7113311bb704c627bb48d | C源/helpers基础，含 midpoint/subpoints/headfix |
| Kujira_C_round6_two_source_increments_20261025.zip | 8ed56a4635fb2197388b3a2688a83fe26603a0e7aca8aa7bb3227b044121e99a | round5；MiMo mid/豆包 start |
| Kujira_C_round6_drop_end_increment.zip | 7bc2737944eafb784aedb6af8323550f18df1a762819b3eb6478a237f9cdf1ce | round5、start |
| Kujira_C_round7_doubao_open_source_pending.zip | cd39f10d9d0cb568aa3e8eb9fb74e9c9e27db9763e4ff76abd907d3f305ef2c5 | round5/start/drop/end |
| Kujira_C_round8_doubao_start_child_INTERNAL.zip | 4a6d98610c0e3b443ba34cada69dbe362e144fd01be769f8aace38f71c9bcb15 | 上述豆包链 |
| Kujira_C_round7_mimo_native_and_rejected_dependencies.zip | 3883f5c3efadaf5f407d3a6d44608b23db2cf5c336f4bfcbd5188a12f2238df1 | round5/headfix、round6mid；含拒收依赖 |

## 离线工具索引
这些是恢复包内的离线工具，不是运行时逻辑，不应加入安装包：
- GPT 精确附录：`exact_video_export.py`、`EXACT_EXPORT_VERIFY.json`、`INDEPENDENT_FRAME_REVIEW.json`。先检查帧时间与原序列一致，再讨论观感。
- 豆包 round8：`native_v3.py → audit.py → package.py`；`sequence_sources.json` 列出13源路径；`SHA256.json` 用于输入完整性。
- C 基础：`group_c/build.py`、`round3/overlay.py`、`registration.json` 与 `interpolation_pilot/interpolate.py`，按各包恢复说明使用。
- Claude：包内 flow/compose/align/audit 工具与源输入；旧失败分支必须保留拒收标签。

环境依赖主要为 Python、Pillow、NumPy、OpenCV、SciPy；视频导出使用 ffmpeg。环境依赖不打进素材恢复包。源包哈希与 ZIP 完整性已经核验；这只证明恢复资料完整，不证明动画通过。

## 下一验收边界
先确认每状态动作语义、人物设定、结构/遮挡/静区与源头姿态，再逐段检查中间态。恢复实时播放条件后，复核原速完整循环和状态切换。没有完成这些步骤前，不替换生产 assets、不发布版本、不合并主线。
