## inspect-ahc-templates

Utility function for validating template coverage against the France-based canonical model.

### What it does

- Downloads each AHC template PDF from storage.
- Extracts all PDF field names.
- Detects template profile/family.
- Builds canonical field mapping via profile adapters.
- Validates required canonical keys resolve.
- Validates lightweight field override targets exist.
- Builds check->France-category map and reports missing categories.
- Returns one manifest JSON for all templates.

### Request

`POST /functions/v1/inspect-ahc-templates`

Body (all optional):

```json
{
  "include_ahc_templates": true,
  "include_document_templates": true,
  "strict_compliance_report": true,
  "save_manifest_to_storage": true,
  "output_bucket": "generated-pdfs",
  "output_path": "manifests/ahc-template-manifest.json"
}
```

### Response

JSON manifest containing:

- `generated_at`
- `total_templates`
- `failing_templates`
- `templates[]` with:
  - `fields`
  - `profile`
  - `missing_required_canonical_keys`
  - `effective_check_category_count`
  - `invalid_override_fields`
  - `unresolved_france_categories`

When `strict_compliance_report: true` is set, templates that do not resolve all France cross-out categories are flagged via `issues[]` with `strict_crossout_noncompliant:*`.
