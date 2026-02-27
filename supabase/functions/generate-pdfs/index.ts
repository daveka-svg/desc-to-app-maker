import "jsr:@supabase/functions-js@2.4.1/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFCheckBox, PDFTextField, PDFName, PDFNumber } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const GENERATED_PDF_BUCKET = Deno.env.get("GENERATED_PDF_BUCKET") || "generated-pdfs";
const GENERATED_PDF_PASSWORD = Deno.env.get("GENERATED_PDF_PASSWORD") || "ETV2026";

const GENERATED_PDF_PERMISSIONS = {
    printing: "highResolution" as const,
    modifying: true,
    copying: true,
    annotating: true,
    fillingForms: true,
    contentAccessibility: true,
    documentAssembly: true,
};

async function applyGeneratedPdfSecurity(pdfDoc: any) {
    if (!GENERATED_PDF_PASSWORD) return;
    if (typeof pdfDoc.encrypt !== "function") return;
    try {
        await pdfDoc.encrypt({
            userPassword: GENERATED_PDF_PASSWORD,
            ownerPassword: GENERATED_PDF_PASSWORD,
            permissions: GENERATED_PDF_PERMISSIONS,
            pdfVersion: "1.7",
        });
    } catch (err) {
        console.warn("PDF encryption failed; continuing without password protection:", err);
    }
}

interface GeneratePDFRequest {
    submission_id: string;
    type: "intake" | "final";
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
        const body: GeneratePDFRequest = await req.json();
        const { submission_id, type } = body;

        if (!submission_id || !type) {
            return new Response(
                JSON.stringify({ error: "Missing submission_id or type" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Fetch submission data
        const { data: submission, error: subError } = await supabase
            .from("submissions")
            .select("*, selected_template:document_templates(*)")
            .eq("id", submission_id)
            .single();

        if (subError || !submission) {
            return new Response(
                JSON.stringify({ error: "Submission not found" }),
                {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        if (type === "intake") {
            // Generate intake summary PDF
            const pdfUrl = await generateIntakePDF(submission, supabase);

            return new Response(
                JSON.stringify({ intake_pdf_url: pdfUrl, pdf_password: GENERATED_PDF_PASSWORD }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        } else if (type === "final") {
            // Generate final AHC PDF
            if (!submission.selected_template) {
                return new Response(
                    JSON.stringify({ error: "No template selected" }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }

            const pdfUrl = await generateFinalAHCPDF(submission, supabase);

            return new Response(
                JSON.stringify({ final_ahc_pdf_url: pdfUrl, pdf_password: GENERATED_PDF_PASSWORD }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        return new Response(
            JSON.stringify({ error: "Invalid type" }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (err) {
        console.error("PDF generation error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

async function generateIntakePDF(submission: any, supabase: any): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const data = submission.data_json || {};
    let yPos = 790;

    const drawText = (text: string, x: number, bold = false) => {
        page.drawText(text, {
            x,
            y: yPos,
            size: 10,
            font: bold ? fontBold : font,
            color: rgb(0, 0, 0),
        });
    };

    const drawSection = (title: string) => {
        yPos -= 20;
        drawText(title, 50, true);
        yPos -= 15;
    };

    const drawRow = (label: string, value: string) => {
        if (value) {
            drawText(label + ":", 50, false);
            drawText(value, 200, false);
            yPos -= 15;
        }
    };

    // Title
    page.drawText("Animal Health Certificate - Intake Summary", {
        x: 50,
        y: yPos,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    yPos -= 10;
    page.drawText(`Submission Date: ${new Date(submission.created_at).toLocaleDateString()}`, {
        x: 50,
        y: yPos,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
    });

    // Owner Details
    drawSection("Owner Details");
    drawRow("Name", data.owner?.firstName ? `${data.owner.firstName} ${data.owner.lastName || ""}` : "");
    drawRow("Address", data.owner?.houseNameNumber
        ? `${data.owner.houseNameNumber} ${data.owner.street}, ${data.owner.townCity}, ${data.owner.postalCode}`
        : "");
    drawRow("Country", data.owner?.country || "");
    drawRow("Phone", data.owner?.phone || "");
    drawRow("Email", data.owner?.email || "");

    // Transport
    drawSection("Transport");
    const transportLabel = data.transport?.transportedBy === "owner" ? "Owner" :
        data.transport?.transportedBy === "authorised" ? "Authorised Person" :
            data.transport?.transportedBy === "carrier" ? "Carrier" : "";
    drawRow("Transported By", transportLabel);
    if (data.transport?.carrierName) drawRow("Carrier Name", data.transport.carrierName);

    // Pet Information
    drawSection("Pet Information");
    drawRow("Name", data.pet?.name || "");
    drawRow("Species", data.pet?.species || "");
    drawRow("Breed", data.pet?.breed === "Other" ? data.pet?.breedOther || "Other" : data.pet?.breed || "");
    drawRow("Date of Birth", data.pet?.dateOfBirth || "");
    drawRow("Colour", data.pet?.colour || "");
    drawRow("Sex", data.pet?.sex || "");
    drawRow("Neutered", data.pet?.neutered || "");
    drawRow("Microchip", data.pet?.microchipNumber || "");
    drawRow("Vaccines Up to Date", data.pet?.routineVaccines || "");

    // Travel
    drawSection("Travel Information");
    drawRow("Means", data.travel?.meansOfTravel === "car_ferry" ? "Car / Ferry" : data.travel?.meansOfTravel || "");
    drawRow("Entry Date", data.travel?.dateOfEntry || "");
    drawRow("First Country", data.travel?.firstCountry || "");
    drawRow("Final Destination", data.travel?.finalCountry || "");
    drawRow("Tapeworm Required", data.travel?.tapewormRequired || "");
    drawRow("Returning < 5 days", data.travel?.returningWithinFiveDays || "");
    if (data.travel?.returningWithinFiveDays === "no") {
        drawRow("Returning < 120 days", data.travel?.returningWithin120Days || "");
    }

    // Rabies
    drawSection("Rabies Vaccination");
    drawRow("Date", data.rabies?.vaccinationDate || "");
    drawRow("Vaccine", data.rabies?.vaccineName || "");
    drawRow("Manufacturer", data.rabies?.manufacturer || "");
    drawRow("Batch", data.rabies?.batchNumber || "");
    drawRow("Valid From", data.rabies?.validFrom || "");
    drawRow("Valid To", data.rabies?.validTo || "");

    // Declaration
    drawSection("Declaration");
    drawRow("Signature", data.declaration?.signature || "");
    drawRow("Date", data.declaration?.date || "");

    // Save PDF
    await applyGeneratedPdfSecurity(pdfDoc);
    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const fileName = `intake-${submission.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from(GENERATED_PDF_BUCKET)
        .upload(fileName, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
        });

    if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(GENERATED_PDF_BUCKET)
        .getPublicUrl(fileName);

    return publicUrl;
}

async function generateFinalAHCPDF(submission: any, supabase: any): Promise<string> {
    const template = submission.selected_template;
    if (!template?.template_pdf_url) {
        throw new Error("No template PDF URL");
    }

    // Fetch the template PDF
    const templateResponse = await fetch(template.template_pdf_url);
    if (!templateResponse.ok) {
        throw new Error("Failed to fetch template PDF");
    }

    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const data = submission.data_json || {};
    const mapping = template.mapping_schema_json || {};

    // 1. Fill fields based on mapping
    for (const [fieldKey, fieldMapping] of Object.entries(mapping as Record<string, any>)) {
        if (!fieldMapping || typeof fieldMapping !== "object") continue;

        const value = getNestedValue(data, fieldKey);
        if (value === null || value === undefined) continue;

        const targetFieldName = fieldMapping.fieldName || fieldKey;

        try {
            // Try to find the field in the PDF form
            const field = form.getField(targetFieldName);

            if (field instanceof PDFCheckBox) {
                if (value === true || String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'true') {
                    field.check();
                } else {
                    field.uncheck();
                }
            } else if (field instanceof PDFTextField) {
                field.setText(String(value));
            } else {
                // For other field types, try to set value if possible
                (field as any).setValue?.(String(value));
            }
        } catch (e) {
            // Field not found in form, fallback to text overlay if coordinates exist
            if (fieldMapping.page !== undefined && fieldMapping.x !== undefined && fieldMapping.y !== undefined) {
                const pages = pdfDoc.getPages();
                if (fieldMapping.page >= 0 && fieldMapping.page < pages.length) {
                    const page = pages[fieldMapping.page];
                    page.drawText(String(value), {
                        x: fieldMapping.x,
                        y: fieldMapping.y,
                        size: fieldMapping.fontSize || 10,
                        font,
                        color: rgb(0, 0, 0),
                        maxWidth: fieldMapping.maxWidth || 200,
                    });
                }
            }
        }
    }

    // 2. Determine and set automatic AHC checkboxes (Business Logic)
    const autoCheckboxes = determineCheckboxes(data);
    for (const [name, checked] of Object.entries(autoCheckboxes)) {
        try {
            const field = form.getCheckBox(name);
            if (checked) field.check();
            else field.uncheck();
        } catch (e) {
            // Ignore if field doesn't exist
        }
    }

    // 3. Apply Strike Toggles
    applyStrikeToggles(form);

    // Save filled PDF
    await applyGeneratedPdfSecurity(pdfDoc);
    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const fileName = `final-ahc-${submission.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from(GENERATED_PDF_BUCKET)
        .upload(fileName, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
        });

    if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(GENERATED_PDF_BUCKET)
        .getPublicUrl(fileName);

    // Update submission status and log
    await supabase
        .from("submissions")
        .update({
            status: "Generated",
            final_ahc_pdf_url: publicUrl
        })
        .eq("id", submission.id);

    await supabase.from("audit_log").insert({
        submission_id: submission.id,
        action: "generated",
        details_json: {
            pdf_url: publicUrl,
            bucket: GENERATED_PDF_BUCKET,
            password_protected: Boolean(GENERATED_PDF_PASSWORD),
        },
    });

    return publicUrl;
}

function getNestedValue(obj: any, path: string): any {
    if (!path) return null;
    const keys = path.split(".");
    let value = obj;
    for (const key of keys) {
        if (value && typeof value === "object") {
            value = value[key];
        } else {
            return null;
        }
    }
    return value;
}

// --- AHC Business Logic for Cross-outs ---

function determineCheckboxes(data: any): Record<string, boolean> {
    const checks: Record<string, boolean> = {};
    const pet = data.pet || {};
    const travel = data.travel || {};

    const isDog = pet.species?.toLowerCase() === 'dog';
    const firstCountry = travel.firstCountry || "";
    const tapewormCountries = ["Finland", "Ireland", "Northern Ireland", "Malta", "Norway"];
    const isTapewormRequired = isDog && tapewormCountries.includes(firstCountry);

    // Logic for crossing out sections based on AHC rules
    // Rule: Check box N to cross out Section N

    // Cross out Tapeworm section if NOT required
    if (!isTapewormRequired) {
        checks['Check 9'] = true;
        checks['Check 10'] = true;
    }

    // More rules can be added here
    return checks;
}

function applyStrikeToggles(form: any) {
    const allFields = form.getFields();
    const pairs = new Map<number, { checkbox: any, strike: any }>();

    for (const field of allFields) {
        const name = field.getName();
        const checkMatch = name.match(/^Check\s*(\d+)$/i);
        if (checkMatch && (field instanceof PDFCheckBox)) {
            const num = parseInt(checkMatch[1]);
            const existing = pairs.get(num) || { checkbox: null, strike: null };
            existing.checkbox = field;
            pairs.set(num, existing);
        }
        const strikeMatch = name.match(/^Strike\s*(\d+)$/i);
        if (strikeMatch && (field instanceof PDFTextField)) {
            const num = parseInt(strikeMatch[1]);
            const existing = pairs.get(num) || { checkbox: null, strike: null };
            existing.strike = field;
            pairs.set(num, existing);
        }
    }

    for (const [num, pair] of pairs) {
        if (!pair.checkbox || !pair.strike) continue;
        const isChecked = pair.checkbox.isChecked();
        const strikeField = pair.strike;
        const widgets = (strikeField as any).acroField.getWidgets();

        for (const widget of widgets) {
            const dict = widget.dict;
            const F = PDFName.of('F');
            const currentF = dict.get(F);
            let flags = 4;
            if (currentF instanceof PDFNumber) {
                flags = currentF.asNumber();
            }
            // bit 1 (value 2) is Hidden
            let newFlags = isChecked ? (flags & ~2) : (flags | 2);
            dict.set(F, PDFNumber.of(newFlags));
        }
        console.log(`Toggled Strike ${num} to ${isChecked ? 'visible' : 'hidden'}`);
    }
}
