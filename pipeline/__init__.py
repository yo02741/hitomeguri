"""ひとめぐり 資料 pipeline。

流程：harvest → dedupe → enrich（LLM）→ verify → 開 PR → build_bundles。
規格見 /PLAN.md §5；資料模型見 pipeline/models.py（對應 PLAN.md §4）。
"""
