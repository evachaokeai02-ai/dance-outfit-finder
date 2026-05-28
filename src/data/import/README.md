# 女团舞数据扩容模板（100首）

本目录用于快速扩充舞蹈库，目标是先完成 **100 首女团舞** 的可审核数据。

## 文件说明

- `girlgroup_dance_template_100.json`
  - 单条 JSON 模板（含后台审核字段）。
  - 适合程序化导入、接口联调。
- `girlgroup_dance_batch_100.csv`
  - 100 行批量模板（`gg-001` ~ `gg-100`）。
  - 适合运营同学批量填写。

## CSV 字段规则

- `*_pipe` 字段使用 `|` 分隔多值。
  - `aliases_pipe`: 别名列表
  - `styleTags_pipe`: 风格标签
  - `sceneTags_pipe`: 场景标签
  - `outfitKeywords_pipe`: 穿搭关键词
  - `review_referenceLinks_pipe`: 参考链接
- `review_confidence`: 0~1 浮点数（建议两位小数）。
- `review_status`: `draft | in_review | approved | rejected`。
- `review_priority`: `P0 | P1 | P2`。
- `review_sourceType`: `manual | crawler | partner_feed`。
- `review_copyrightRisk`: `low | medium | high`。

## 建议的审核流

1. `draft`：运营录入基础字段与参考链接。  
2. `in_review`：穿搭/内容审核补齐 `fitNotes`、`qaNotes`。  
3. `approved`：入正式库（可同步到 `src/data/danceStyles.json` 或后端库）。  
4. `rejected`：保留记录并写明 `qaNotes` 便于二次修订。

## 从 CSV 转 JSON 的最小转换规则

- `aliases_pipe` → `aliases: string[]`
- `styleTags_pipe` → `styleTags: string[]`
- `sceneTags_pipe` → `sceneTags: string[]`
- `outfitKeywords_pipe` → `outfitKeywords: string[]`
- `review_referenceLinks_pipe` → `review.referenceLinks: string[]`

> 注意：当前前端 `findDance` 依赖 `danceName + aliases` 精确规范化匹配，别名务必覆盖空格/连写/中文常见写法。
