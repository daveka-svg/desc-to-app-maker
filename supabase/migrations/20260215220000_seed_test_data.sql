-- Add more template seeds for common EU destinations

INSERT INTO public.document_templates (name, first_country_of_entry, second_language_code, template_pdf_url, active)
VALUES 
  ('AHC - English/Spanish (Spain)', 'Spain', 'es', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true),
  ('AHC - English/Italian (Italy)', 'Italy', 'it', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true),
  ('AHC - English/German (Germany)', 'Germany', 'de', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true),
  ('AHC - English/Dutch (Netherlands)', 'Netherlands', 'nl', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true),
  ('AHC - English/Portuguese (Portugal)', 'Portugal', 'pt', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true),
  ('AHC - English/Greek (Greece)', 'Greece', 'el', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true);

-- Add demo submissions for testing
DO $$
DECLARE
  demo_clinic_id UUID := '00000000-0000-0000-0000-000000000001';
  cat_submission_id UUID;
  dog_submission_id UUID;
BEGIN
  -- Demo cat submission (France)
  INSERT INTO public.submissions (
    clinic_id,
    status,
    owner_name,
    owner_email,
    entry_date,
    first_country_of_entry,
    final_destination,
    pets_count,
    data_json
  ) VALUES (
    demo_clinic_id,
    'Submitted',
    'Jane Smith',
    'jane.smith@example.com',
    '2026-03-15',
    'France',
    'France',
    1,
    '{ 
      "owner": {
        "firstName": "Jane",
        "lastName": "Smith",
        "houseNameNumber": "45",
        "street": "Baker Street",
        "townCity": "London",
        "postalCode": "W1U 6TN",
        "country": "United Kingdom",
        "phone": "+44 20 7946 0958",
        "email": "jane.smith@example.com"
      },
      "transport": {
        "transportedBy": "owner",
        "carrierName": ""
      },
      "authorisedPerson": {
        "firstName": "",
        "lastName": "",
        "houseNameNumber": "",
        "street": "",
        "townCity": "",
        "postalCode": "",
        "phone": "",
        "email": ""
      },
      "pet": {
        "name": "Whiskers",
        "species": "Cat",
        "breed": "British Shorthair",
        "breedOther": "",
        "dateOfBirth": "2022-05-10",
        "colour": "Grey",
        "sex": "Female",
        "neutered": "Yes",
        "microchipNumber": "982000123456789",
        "microchipDate": "2022-05-15",
        "routineVaccines": "Yes"
      },
      "travel": {
        "meansOfTravel": "car_ferry",
        "dateOfEntry": "2026-03-15",
        "firstCountry": "France",
        "finalCountry": "France",
        "tapewormRequired": "no",
        "returningWithinFiveDays": "no",
        "returningWithin120Days": "yes"
      },
      "rabies": {
        "vaccinationDate": "2025-12-01",
        "vaccineName": "Nobivac Rabies",
        "manufacturer": "MSD Animal Health",
        "batchNumber": "ABC123",
        "validFrom": "2025-12-22",
        "validTo": "2028-12-01"
      },
      "uploads": {
        "rabiesCertificate": null,
        "rabiesCertificateName": ""
      },
      "declaration": {
        "agreed": true,
        "signature": "Jane Smith",
        "date": "2026-02-10"
      }
    }'::jsonb
  ) RETURNING id INTO cat_submission_id;

  -- Auto-select template for cat
  UPDATE public.submissions
  SET selected_template_id = (
    SELECT id FROM public.document_templates 
    WHERE first_country_of_entry = 'France' AND active = true 
    LIMIT 1
  )
  WHERE id = cat_submission_id;

  -- Demo dog submission (Spain) with correction request
  INSERT INTO public.submissions (
    clinic_id,
    status,
    owner_name,
    owner_email,
    entry_date,
    first_country_of_entry,
    final_destination,
    pets_count,
    correction_message,
    data_json
  ) VALUES (
    demo_clinic_id,
    'NeedsCorrection',
    'John Doe',
    'john.doe@example.com',
    '2026-04-20',
    'Spain',
    'Spain',
    1,
    'Please update the rabies vaccination date - it should be from your most recent visit.',
    '{
      "owner": {
        "firstName": "John",
        "lastName": "Doe",
        "houseNameNumber": "10",
        "street": "Downing Street",
        "townCity": "London",
        "postalCode": "SW1A 2AA",
        "country": "United Kingdom",
        "phone": "+44 20 7123 4567",
        "email": "john.doe@example.com"
      },
      "transport": {
        "transportedBy": "owner",
        "carrierName": ""
      },
      "authorisedPerson": {
        "firstName": "",
        "lastName": "",
        "houseNameNumber": "",
        "street": "",
        "townCity": "",
        "postalCode": "",
        "phone": "",
        "email": ""
      },
      "pet": {
        "name": "Max",
        "species": "Dog",
        "breed": "Labrador Retriever",
        "breedOther": "",
        "dateOfBirth": "2020-08-15",
        "colour": "Golden",
        "sex": "Male",
        "neutered": "Yes",
        "microchipNumber": "982000987654321",
        "microchipDate": "2020-08-20",
        "routineVaccines": "Yes"
      },
      "travel": {
        "meansOfTravel": "air",
        "dateOfEntry": "2026-04-20",
        "firstCountry": "Spain",
        "finalCountry": "Spain",
        "tapewormRequired": "yes",
        "returningWithinFiveDays": "yes",
        "returningWithin120Days": ""
      },
      "rabies": {
        "vaccinationDate": "2024-01-10",
        "vaccineName": "Rabisin",
        "manufacturer": "Boehringer Ingelheim",
        "batchNumber": "XYZ789",
        "validFrom": "2024-01-31",
        "validTo": "2027-01-10"
      },
      "uploads": {
        "rabiesCertificate": null,
        "rabiesCertificateName": ""
      },
      "declaration": {
        "agreed": true,
        "signature": "John Doe",
        "date": "2026-02-12"
      }
    }'::jsonb
  ) RETURNING id INTO dog_submission_id;

  -- Auto-select template for dog
  UPDATE public.submissions
  SET selected_template_id = (
    SELECT id FROM public.document_templates 
    WHERE first_country_of_entry = 'Spain' AND active = true 
    LIMIT 1
  )
  WHERE id = dog_submission_id;

  -- Add audit logs for both submissions
  INSERT INTO public.audit_log (submission_id, action, details_json)
  VALUES 
    (cat_submission_id, 'created', '{"source": "seed_data", "pet_type": "cat"}'::jsonb),
    (cat_submission_id, 'submitted', '{"source": "seed_data"}'::jsonb),
    (dog_submission_id, 'created', '{"source": "seed_data", "pet_type": "dog"}'::jsonb),
    (dog_submission_id, 'submitted', '{"source": "seed_data"}'::jsonb),
    (dog_submission_id, 'correction_requested', '{"message": "Please update the rabies vaccination date"}'::jsonb);

END $$;
