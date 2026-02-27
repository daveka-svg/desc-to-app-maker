
# Fix AHC PDF Generation - Key Mismatch

## Root Cause

The edge function logs show `Cleared 129/129 fields` then `Filled 0 fields, 0 missing/skipped`. This means the mapping loop runs but finds **zero matching keys** between the normalized data map and the mapping JSON.

**Mapping keys in the database** (from the imported mapping pack):
- `owner.fullName`, `owner.address`, `owner.phone`
- `pets[0].microchip`, `pets[0].rabies.date`, etc.
- `ov.name`, `ov.address`, `ov.qualification`, `ov.telephone`
- `certificate.issueDate`, `certificate.reference`
- `declaration.placeDate`
- `destination.name`, `destination.address`, `destination.phone`, `destination.postcode`
- `transport.transporter`, `goods.description`, `goods.quantity`, `localCompetentAuthority`

**Normalized keys in the edge function code** (what it actually builds):
- `owner.fullName`, `owner.address`, `owner.phone` -- these match
- `pets[0].microchip`, `pets[0].rabies.date`, etc. -- these match
- `issuer.name` -- should be `ov.name`
- `issuer.issueDate` -- should be `certificate.issueDate`
- `issuer.certificateNumber` -- should be `certificate.reference`
- No entries for `destination.*`, `declaration.*`, `transport.*`, `goods.*`, `localCompetentAuthority`

The owner and pet keys DO match, but the issuer/vet, certificate, destination, and declaration keys are completely misaligned. Since the mapping loop iterates mapping keys and looks them up in `normalized[canonicalKey]`, those keys return `""` (empty string). But the owner/pet keys should work... unless the mapping entry format causes a mismatch.

Wait -- re-reading the code: `normalized[canonicalKey] || ""` would still give `""` and `textField.setText("")` would increment `missingCount`, not `filledCount`. But the log says `0 missing/skipped` too. That means the mapping object itself is empty or the loop body is never entered.

Looking more carefully: the template query uses `.select("*, ahc_template_mappings(*)")` which returns `ahc_template_mappings` as an array. The code reads `template.ahc_template_mappings?.[0]?.mapping_json`. The DB query confirms mapping_json exists and is populated. So this should work.

The actual issue is likely that **the deployed function is stale** -- the code in the repo looks correct but may not match what's actually running. The logs showing "Filled 0" with the current code that should at minimum fill owner/pet fields confirms a deployment mismatch.

## Fix Plan

### 1. Update `generate-ahc` edge function to align ALL canonical keys

Add the missing normalized keys to match the mapping pack format:

```
// Mapping pack keys -> Normalized values
"ov.name"              -> vet full_name
"ov.address"           -> practice address
"ov.qualification"     -> vet role_title
"ov.telephone"         -> practice phone
"certificate.issueDate" -> submission issue_datetime (dd/mm/yyyy)
"certificate.reference" -> submission certificate_number
"declaration.placeDate" -> submission issue_place + issue_datetime
"destination.name"     -> (from data_json if available)
"destination.address"  -> (from data_json if available)
"destination.phone"    -> (from data_json if available)
"destination.postcode" -> (from data_json if available)
"transport.transporter"-> d.travel?.transportMethod
"goods.description"    -> pet species
"goods.quantity"       -> "1" (or pets count)
"localCompetentAuthority" -> "" (left blank for vet to fill)
```

Also keep the existing `issuer.*` keys as aliases so both naming conventions work.

### 2. Add debug logging to the mapping loop

Log the first 5 mapping keys and their resolved values so we can see exactly what's happening:

```
console.log("Mapping keys:", Object.keys(mapping).slice(0, 10));
console.log("Normalized keys:", Object.keys(normalized).slice(0, 10));
```

### 3. Redeploy the edge function

Force a fresh deployment to ensure the latest code is running.

### 4. File changes

Only one file needs to change:

**`supabase/functions/generate-ahc/index.ts`**
- Expand the `normalized` map to include all canonical keys used by the mapping pack (`ov.*`, `certificate.*`, `declaration.*`, `destination.*`, `transport.*`, `goods.*`)
- Add debug logging for mapping key resolution
- Keep everything else the same (clearing logic, editable output, no flatten)

### 5. No database or frontend changes needed

The mapping data in the database is correct. The submission data is correct. Only the edge function's key translation layer is broken.
