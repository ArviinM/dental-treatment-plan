-- =============================================================================
-- GENERATED FILE — do not edit by hand.
--   node scripts/generate-seed.mjs
--
-- Seeds the reference data the app currently hardcodes, so a fresh database
-- behaves exactly like the version the team uses today.
--
-- Every statement is idempotent and NON-DESTRUCTIVE: re-running inserts what
-- is missing and leaves existing rows alone. Once Ericka has edited a fee or a
-- dentist, this file must never overwrite her.
-- =============================================================================

-- Clinics (from LOCATIONS in src/types/index.ts)
insert into public.clinics (slug, name, website, phone, address, sort_order) values
  ('essendon', 'Essendon', 'siadental.com.au', '(03) 9289 3999', '1136-1140 Mt Alexander Rd, Essendon, VIC 3040', 0),
  ('burwood', 'Burwood', 'siadentalburwood.com.au', '(03) 8538 6199', '138-140 Burwood Hwy, Burwood, VIC 3125', 1),
  ('mulgrave', 'Mulgrave', 'siadentalmulgrave.com.au', '(03) 9289 3999', 'Level 1, 372 Wellington Rd, Mulgrave, VIC 3170', 2)
on conflict (slug) do nothing;

-- Dentists (from src/data/dentists.ts). SQL cannot carry binary files, so
-- photo_path is left null here and filled in by the other half of this
-- migration: node scripts/migrate-staff-photos.mjs --apply
insert into public.staff_members (slug, full_name, is_dentist, sort_order) values
  ('dr-siv-lengsavath', 'Dr Siv Lengsavath', true, 0),
  ('dr-adina-low', 'Dr Adina Low', true, 1),
  ('dr-esther-chin', 'Dr Esther Chin', true, 2),
  ('dr-jessy-youn', 'Dr Jessy Youn', true, 3),
  ('dr-kimberlyn-ong', 'Dr Kimberlyn Ong', true, 4),
  ('dr-won-noh', 'Dr Won Noh', true, 5),
  ('dr-brenda-morris', 'Dr Brenda Morris', true, 6),
  ('dr-claire-tan', 'Dr Claire Tan', true, 7),
  ('dr-dan-trinh', 'Dr Dan Trinh', true, 8),
  ('dr-edmund-kwong', 'Dr Edmund Kwong', true, 9),
  ('dr-kelly-sin', 'Dr Kelly Sin', true, 10),
  ('dr-rama-chockalingam', 'Dr Rama Chockalingam', true, 11),
  ('dr-yeseul-baek', 'Dr Yeseul Baek', true, 12),
  ('dr-david-liu', 'Dr David Liu', true, 13)
on conflict (slug) do nothing;

-- Which clinics each dentist works at (Dr Siv Lengsavath is at two).
insert into public.staff_member_clinics (staff_member_id, clinic_id)
select s.id, c.id
  from public.staff_members s
  join (values
    ('dr-siv-lengsavath', 'burwood'),
    ('dr-siv-lengsavath', 'mulgrave'),
    ('dr-adina-low', 'burwood'),
    ('dr-adina-low', 'mulgrave'),
    ('dr-esther-chin', 'burwood'),
    ('dr-jessy-youn', 'burwood'),
    ('dr-kimberlyn-ong', 'burwood'),
    ('dr-kimberlyn-ong', 'mulgrave'),
    ('dr-won-noh', 'burwood'),
    ('dr-brenda-morris', 'mulgrave'),
    ('dr-claire-tan', 'essendon'),
    ('dr-dan-trinh', 'essendon'),
    ('dr-edmund-kwong', 'essendon'),
    ('dr-kelly-sin', 'essendon'),
    ('dr-rama-chockalingam', 'essendon'),
    ('dr-yeseul-baek', 'essendon'),
    ('dr-david-liu', 'essendon')
  ) as v (staff_slug, clinic_slug) on v.staff_slug = s.slug
  join public.clinics c on c.slug = v.clinic_slug
on conflict do nothing;

-- Fee schedule: 168 item codes
-- (from src/data/default-fee-schedule.ts)
insert into public.fee_items (code, name, description, fee, sort_order) values
  ('011', 'Comprehensive Oral Examination', 'We’ll do a thorough check of your teeth, gums, and mouth to understand your overall oral health and identify any concerns early.', 84, 0),
  ('012', 'Periodic Oral Examination', 'A routine dental check-up to monitor your oral health and catch any issues before they become bigger problems.', 76, 1),
  ('013', 'Oral Examination Limited', 'A short dental exam focused on a specific issue or tooth that''s bothering you.', 70, 2),
  ('014', 'Consultation', 'We’ll sit down with you to discuss your dental concerns and smile goals, and explain the treatment options best suited for you.', 84, 3),
  ('015', 'Consultation - Extended (30Mins Or More)', 'A longer consultation for more detailed discussions, perfect for complex treatments or second opinions.', 120, 4),
  ('018', 'Written Report (Not Elsewhere Completed)', 'A formal written report about your dental condition, often needed for referrals, insurance, or records.', 147, 5),
  ('022', 'Intraoral Periapical Or Bitewing Radiograph - per exposure', 'A small X-ray to look closely at a specific tooth or area to check for problems like decay or infection.', 48, 6),
  ('037', 'Panormanic Radiograph - per exposure', 'A full-mouth X-ray that lets us see your entire jaw and all teeth in one image – useful for wisdom teeth, implants, or overall checks.', 133, 7),
  ('047', 'Saliva Screening Test', 'A quick test of your saliva to assess your risk of tooth decay or gum disease and help us plan your care.', 72, 8),
  ('061', 'Pulp Testing - per appointment', 'We’ll test the nerve of a tooth to see if it''s alive or damaged – helpful for diagnosing pain or trauma.', 45, 9),
  ('071', 'Diagnostic Model - per model', 'We’ll take impressions of your teeth to make a model. This helps us plan your treatment and show you what your future smile might look like.', 81, 10),
  ('072', 'Photographic Records - Intraoral - per appointment', 'We’ll take close-up photos inside your mouth to track your progress and treatment results.', 45, 11),
  ('073', 'Photographic Records - Extraoral - per appointment', 'We’ll take photos of your smile and face to ensure everything stays balanced and looks natural.', 53, 12),
  ('074', 'Diagnostic wax-up', 'We’ll create a mock-up of your expected results so you can preview your new smile before we begin.', 115, 13),
  ('075', 'Diagnostic Modelling', 'We’ll scan your teeth digitally to create a precise 3D model. It’s quick, clean, and helps us plan accurately.', 84, 14),
  ('111', 'Removal Of Plaque and/or Stain', 'We’ll clean off surface stains and plaque to freshen up your smile and help keep your teeth healthy.', 95, 15),
  ('113', 'Recontouring & Polishing of Pre-Existing Restoration(S)', 'We’ll polish or reshape your current fillings to make them smoother, more comfortable, and look better.', 69, 16),
  ('114', 'Removal Of Calculus - first appointment', 'We’ll remove tartar and hard build-up from your teeth to reduce inflammation and improve gum health.', 127, 17),
  ('115', 'Removal of calculus - subsequent appointment', 'A follow-up cleaning to remove remaining tartar and maintain your gum health.', 145, 18),
  ('116', 'Enamel micro-abrasion - per tooth', 'We’ll gently smooth out surface stains or white spots on your teeth for a more even appearance.', 52, 19),
  ('117', 'Bleaching, Internal - per tooth', 'We’ll whiten the inside of a darkened tooth that’s had root canal treatment to match your other teeth.', 352, 20),
  ('118', 'Bleaching, External - per tooth', 'We’ll safely whiten your teeth to brighten your smile and boost your confidence.', 55, 21),
  ('119', 'Bleaching, Home Application - per arch', 'We’ll give you custom-made trays and gel so you can whiten your teeth at home, gradually and comfortably.', 197.5, 22),
  ('121', 'Topical Application Of Remineralisation &/or Cariostatic', 'We’ll apply fluoride or a similar agent to your teeth to help prevent cavities and strengthen enamel.', 38, 23),
  ('122', 'Topical Remineralisation &/or Cariostatic Agents, Home', 'We’ll recommend special at-home products to help protect and remineralize your teeth between visits.', 53, 24),
  ('123', 'Concentrated Remineralsation &/or Cariostatic Agents,', 'We’ll apply a highly concentrated treatment to strengthen your teeth and reduce the risk of cavities.', 26, 25),
  ('131', 'Dietary Analysis & Advice', 'We’ll apply a highly concentrated treatment to strengthen your teeth and reduce the risk of cavities.', 53, 26),
  ('141', 'Oral Hygiene Instruction', 'We’ll teach you the best way to brush and floss so you can keep your mouth as healthy as possible between visits.', 55, 27),
  ('142', 'Tobacco Counselling', 'We’ll help you understand how tobacco affects your oral health and support you in quitting, if needed', 55, 28),
  ('151', 'Provision of Mouthguard - Indirect T', 'We’ll make a custom-fit mouthguard to protect your teeth during sports or while you sleep', 260, 29),
  ('161', 'Fissure and/or tooth surface Sealing - Per Tooth', 'We’ll seal the grooves of your back teeth to protect them from cavities, especially helpful for kids or cavity-prone patients', 62, 30),
  ('165', 'Desensitising Procedure - Per Appointment', 'We’ll apply a special treatment to help reduce sensitivity and make eating or drinking more comfortable.', 42, 31),
  ('171', 'Odontoplasty - Per Tooth', 'We’ll gently reshape a tooth to improve its look or help with your bite.', 80, 32),
  ('213', 'Treatment of Acute Periodontal Infection - per appointment', 'We’ll treat gum infections quickly to relieve pain and prevent further damage to your gums or teeth.', 141, 33),
  ('221', 'Clinical Periodontal Analysis & Recording', 'We’ll do a detailed exam of your gums to check for signs of gum disease and plan the right care.', 70, 34),
  ('222', 'Periodontal Debridement - per tooth', 'We’ll clean around your teeth and under your gums to remove bacteria and help your gums heal.', 48, 35),
  ('223', 'Non-Surgical Treatment Of Peri-Implant Disease - per im', 'We’ll treat infected tissue around implants to prevent bone loss and support healing.', 194, 36),
  ('232', 'Periodontal Flap Surgery - per tooth', 'We’ll gently lift the gums for a deep clean around the roots of your teeth if gum disease is advanced.', 345, 37),
  ('250', 'Active Non-Surgical Periodontal Therapy - per quadrant', 'We’ll clean deep under the gums in one section of your mouth to stop gum disease from progressing.', 260, 38),
  ('251', 'Supportive Periodontal Therapy - per appointment', 'We’ll do regular cleanings and checks to maintain your gum health after periodontal treatment.', 232, 39),
  ('311', 'Removal Of Tooth Or Part(s) Thereof', 'We’ll gently remove a tooth that can’t be saved or is causing problems like pain or crowding.', 225, 40),
  ('314', 'Sectional Removal of a Tooth or part(s) thereof', 'We’ll section the tooth to remove it in parts when a simple extraction isn’t enough.', 290, 41),
  ('322', 'Surgical removal of a tooth or fragment not requiring rem', 'We’ll surgically remove a tooth that hasn’t come through properly, usually done gently and with care.', 322, 42),
  ('324', 'Surgical removal of a tooth or fragment requiring both re', 'We’ll remove a problem tooth that requires both cutting and lifting techniques for safe removal.', 440, 43),
  ('332', 'Osteotomy - per jaw', 'A surgery to reshape the bone in your jaw, usually to help prepare for dentures or implants.', 365, 44),
  ('378', 'Surgical Removal Of Foreign Body', 'We’ll carefully remove a foreign object (like a splinter or piece of metal) from your gums or mouth.', 174, 45),
  ('379', 'Marsupialisation Of Cyst', 'We’ll treat a fluid-filled swelling by opening and draining it to relieve pressure and prevent infection.', 180, 46),
  ('381', 'Surgical Exposure Of Unerupted Tooth - per tooth', 'We’ll gently uncover a tooth that hasn’t come through the gum properly so it can erupt naturally or be moved with braces.', 230, 47),
  ('384', 'Repositioning of displaced tooth/teeth - per tooth', 'We’ll carefully reposition a tooth that’s been pushed out of place due to injury to help it heal correctly.', 122, 48),
  ('386', 'Splinting of displaced tooth/teeth - per tooth', 'We’ll apply a splint to stabilize a loose or injured tooth so it stays in position while healing.', 243, 49),
  ('391', 'Frenectomy', 'We’ll remove or reshape the small fold of tissue (frenum) under your tongue or lip to improve comfort or function.', 296, 50),
  ('392', 'Drainage of abscess', 'We’ll drain an infection or abscess to relieve pain and allow healing.', 130, 51),
  ('411', 'Direct Pulp Capping', 'We’ll place a protective dressing over a small exposure in the tooth pulp to help it heal and avoid root canal treatment.', 68, 52),
  ('414', 'Pulpotomy', 'We’ll remove the top portion of the tooth’s nerve and place a medication to preserve the rest, often used in baby teeth.', 161, 53),
  ('415', 'Complete chemo-mechanical preparation of root canal -', 'We’ll clean and shape the root canal system of a tooth to prepare it for filling, usually due to infection or damage.', 305, 54),
  ('416', 'Complete chemo-mechanical preparation of root canal -', 'We’ll do a full cleaning of the root canals in a tooth with multiple roots, preparing it for sealing.', 160, 55),
  ('417', 'Root Canal Obturation  - one canal', 'We’ll seal the root canal of a tooth that had a single canal, completing the root canal treatment.', 303, 56),
  ('418', 'Root Canal Obturation  - each additional canal', 'We’ll fill and seal any additional root canals in the same tooth as part of a complete root canal procedure.', 187, 57),
  ('419', 'Extirpation of pulp or debridement of root canal(s) - emer', 'We’ll remove infected or dead tissue from inside the tooth to relieve pain and stop infection.', 350, 58),
  ('451', 'Removal Of Root Filling - per canal', 'We’ll remove an old root canal filling if re-treatment is needed due to persistent infection or failure.', 175, 59),
  ('452', 'Removal of a cemented root canal post or post crown', 'We’ll take out a post or crown that’s cemented into a tooth if replacement or retreatment is needed.', 352, 60),
  ('455', 'Additional visit for irrigation and/or dressing of the root c', 'This is a follow-up appointment to flush out and medicate the root canal before completing treatment.', 188, 61),
  ('521', 'Adhesive restoration - one surface - anterior tooth - direc', 'We’ll repair a small part of a front tooth using tooth-coloured material to restore function and appearance.', 213, 62),
  ('522', 'Adhesive restoration - two surfaces - anterior tooth - dire', 'We’ll restore two surfaces of a front tooth using tooth-coloured filling material for natural results.', 230, 63),
  ('523', 'Adhesive restoration - three surfaces - anterior tooth - dir', 'We’ll rebuild three surfaces of a front tooth with composite resin to restore structure and appearance.', 266, 64),
  ('524', 'Adhesive restoration - four surfaces - anterior tooth - dire', 'We’ll restore four surfaces of a front tooth, typically when a larger area has been damaged or decayed.', 320, 65),
  ('525', 'Adhesive restoration - five surfaces - anterior tooth - dire', 'We’ll repair almost the entire surface of a front tooth using high-quality tooth-coloured material.', 365, 66),
  ('526', 'Adhesive restoration - veneer - anterior tooth - direct', 'We’ll apply a thin layer of composite on the front of a tooth to improve its colour, shape, or size.', 469, 67),
  ('531', 'Adhesive restoration - one surface - posterior tooth - dire', 'We’ll fix a back tooth with a small composite filling that blends in with your natural teeth.', 214, 68),
  ('532', 'Adhesive restoration - two surfaces - posterior tooth - dir', 'We’ll restore two sides of a back tooth, usually to repair damage from decay or wear.', 255, 69),
  ('533', 'Adhesive restoration - three surfaces - posterior tooth - d', 'We’ll rebuild three surfaces of a back tooth for both strength and a natural look.', 299, 70),
  ('534', 'Adhesive restoration - four surfaces - posterior tooth - dir', 'We’ll restore four surfaces of a molar or premolar tooth for large cavities or breaks.', 341, 71),
  ('535', 'Adhesive restoration - five surfaces - posterior tooth - dir', 'We’ll repair nearly the entire chewing surface of a back tooth using durable tooth-coloured material.', 384, 72),
  ('536', 'Adhesive restoration - veneer - posterior tooth - direct', 'We’ll apply a veneer on the back tooth using composite resin to improve function or aesthetics.', 458, 73),
  ('551', 'Tooth-coloured restoration - one surface - indirect', 'We’ll place a custom-made indirect filling on one surface for added strength and longevity.', 1106, 74),
  ('552', 'Tooth-coloured restoration - two surfaces - indirect', 'We’ll restore two surfaces of a tooth using a lab-made filling for improved durability.', 1275, 75),
  ('553', 'Tooth-coloured restoration - three surfaces - indirect', 'We’ll rebuild three surfaces of a tooth using a high-strength indirect restoration.', 1456, 76),
  ('554', 'Tooth-coloured restoration - four surfaces - indirect', 'We’ll repair most of a tooth with a custom-made piece that’s cemented into place.', 1638, 77),
  ('555', 'Tooth-coloured restoration - five surfaces - indirect', 'We’ll restore nearly the full surface of a tooth with a long-lasting, aesthetic filling.', 1805, 78),
  ('556', 'Tooth-coloured - veneer - indirect', 'We’ll place a custom-made porcelain or composite veneer over your tooth to enhance its appearance.', 1638, 79),
  ('572', 'Provisional (intermediate/temp) Restoration  - per tooth', 'We’ll place a temporary filling to protect the tooth until a permanent restoration is completed.', 183, 80),
  ('574', 'Metal Band', 'We’ll use a metal band to help shape and support a tooth during restoration or filling.', 146, 81),
  ('575', 'Pin Retention  - per pin', 'We’ll place a small metal pin to help secure the filling material inside a heavily damaged tooth.', 55, 82),
  ('577', 'Cusp Capping  - Per Cusp', 'We’ll cover the tooth’s cusp with filling material to strengthen it and restore function.', 56, 83),
  ('578', 'Restoration of an incisal corner - per corner', 'We’ll restore a chipped or broken corner of a front tooth so it looks natural again.', 56, 84),
  ('579', 'Bonding Of Tooth Fragment', 'We’ll bond a broken piece of your tooth back in place using special dental adhesive.', 208, 85),
  ('586', 'Crown - Metallic - With Tooth Preparation  - Preformed', 'We’ll place a pre-formed metal crown to protect and restore a damaged tooth.', 588, 86),
  ('587', 'Crown - Metallic - Minimal Tooth Preparation  - Preforme', 'We’ll fit a thin metal crown over the tooth with minimal preparation needed.', 600, 87),
  ('588', 'Crown - tooth-coloured - preformed', 'We’ll place a pre-formed tooth-coloured crown to restore both function and appearance.', 1148, 88),
  ('595', 'Removal of Indirect Restoration', 'We’ll remove a crown, bridge, or other restoration that needs replacement or adjustment.', 161, 89),
  ('596', 'Recementing Of Indirect Restoration', 'We’ll re-cement a crown or bridge that has come loose to keep it secure.', 142, 90),
  ('597', 'Post - direct', 'We’ll place a support post directly into the root of a tooth to help hold a restoration in place.', 238, 91),
  ('611', 'Full crown - acrylic resin - indirect', 'We’ll create a full acrylic crown in the lab and cement it to your tooth for protection and aesthetics.', 1941, 92),
  ('613', 'Full crown - non-metallic - indirect', 'We’ll fit a full crown made from ceramic or other non-metal material for a natural look.', 1750, 93),
  ('615', 'Full crown - veneered - indirect', 'We’ll use a crown with a layered ceramic coating for a more aesthetic finish.', 1941, 94),
  ('618', 'Full crown - metallic - indirect', 'We’ll place a metal crown to restore strength and durability, often for back teeth.', 1941, 95),
  ('625', 'Post and core for crown - indirect', 'We’ll build a post and core inside your tooth to support a crown securely.', 570, 96),
  ('627', 'Post and root cap - indirect', 'We’ll place a post and cap over the root of a tooth to stabilize it and support a crown.', 306, 97),
  ('629', 'Post and root cap - indirect', 'We’ll use a post and cap system to strengthen a damaged tooth for further restoration.', 255, 98),
  ('631', 'Provisional crown - per tooth', 'We’ll place a temporary crown to protect your tooth until the final crown is ready.', 289, 99),
  ('632', 'Provisional bridge pontic - per pontic', 'We’ll make a temporary bridge tooth to fill a gap while your permanent one is made.', 327, 100),
  ('633', 'Provisional implant abutment - per abutment', 'We’ll place a temporary abutment on your implant while the final restoration is being prepared.', 428, 101),
  ('634', 'Provisional implant restoration - per implant abutment', 'We’ll attach a temporary crown to your implant so you can function and smile comfortably.', 517, 102),
  ('643', 'Bridge pontic - indirect - per pontic', 'We’ll add a bridge tooth (pontic) to fill a gap, supported by crowns on nearby teeth.', 1528, 103),
  ('644', 'Semi fixed attachment', 'We’ll use a semi-fixed attachment to link parts of your dental restoration securely.', 155, 104),
  ('651', 'Recementing Crown or Veneer', 'We’ll re-cement a loose crown or veneer so it stays in place properly.', 202, 105),
  ('661', 'Fitting of implant abutment - per abutment', 'We’ll place the abutment — the piece that connects your implant to the final tooth.', 1136, 106),
  ('665', 'Prosthesis with resin base attached to implants - remova', 'We’ll attach a removable denture to implants using a resin base for stability and comfort.', 2217, 107),
  ('666', 'Prosthesis with metal frame attached to implants - fixed -', 'We’ll fix a metal-based denture onto implants for a secure and long-lasting result.', 4088, 108),
  ('667', 'Prosthesis with metal frame attached to implants - remov', 'We’ll attach a removable metal-based denture to implants for improved strength and stability.', 3638, 109),
  ('672', 'Full crown attached to osseointegrated implant - veneere', 'We’ll fit a custom crown over an implant, blending with your natural teeth.', 2421, 110),
  ('688', 'Insertion of one-stage endosseous implant - per implant', 'We’ll place an implant into your jawbone to replace a missing tooth root.', 3033, 111),
  ('711', 'Complete Maxillary Denture', 'We’ll create a full upper denture to restore your smile and improve function.', 1848, 112),
  ('712', 'Complete Mandibular Denture', 'We’ll make a full lower denture to help with chewing, speech, and confidence.', 1848, 113),
  ('713', 'Provisional Complete Maxillary Denture', 'We’ll give you a temporary upper denture while your permanent one is being made.', 702, 114),
  ('714', 'Provisional Complete Mandibular Denture', 'We’ll provide a temporary lower denture until the final one is ready.', 702, 115),
  ('719', 'Complete maxillary and mandibular dentures', 'We’ll make both upper and lower dentures to fully restore your smile and bite.', 3465, 116),
  ('721', 'Partial Maxillary denture  - resin base', 'We’ll create a partial upper denture using a resin base to replace missing teeth.', 1560, 117),
  ('722', 'Partial Mandibular denture  - resin base', 'We’ll provide a lower partial denture with a resin base to fill gaps comfortably.', 1560, 118),
  ('727', 'Partial Maxillary denture - cast metal framework', 'We’ll make a stronger partial upper denture with a cast metal frame for support.', 2195, 119),
  ('728', 'Partial Mandibular denture - cast metal framework', 'We’ll provide a cast metal partial lower denture for better fit and durability.', 1931, 120),
  ('731', 'Retainer - per tooth', 'We’ll make or adjust a retainer to help maintain your tooth alignment.', 78, 121),
  ('732', 'Occlusal rest - per rest', 'We’ll add a resting component to support your denture and improve comfort.', 35, 122),
  ('733', 'Tooth/Teeth (partial denture)', 'We’ll add or adjust teeth on your partial denture to improve its function.', 68, 123),
  ('736', 'Immediate Tooth Replacement  - per tooth', 'We’ll place a temporary tooth immediately after extraction so your smile stays intact.', 17, 124),
  ('737', 'Resilient Lining', 'We’ll add a soft lining to your denture for extra comfort, especially if gums are sore.', 347, 125),
  ('741', 'Adjustment of a denture', 'We’ll adjust your denture to improve its fit and relieve any pressure points.', 88, 126),
  ('743', 'Relining - complete denture - processed', 'We’ll reline the inside of your full denture using lab-processed materials for better fit.', 636, 127),
  ('744', 'Relining - partial denture - processed', 'We’ll reline your partial denture in the lab to make it fit better.', 461, 128),
  ('751', 'Relining - complete denture - direct', 'We’ll reline your complete denture directly in the clinic for immediate improvement.', 388, 129),
  ('752', 'Relining - partial denture - direct', 'We’ll reline your partial denture directly during your appointment.', 453, 130),
  ('754', 'Denture base modification', 'We’ll modify the base of your denture to improve its fit or comfort.', 230, 131),
  ('761', 'Reattaching pre-existing Clasp to denture', 'We’ll reattach a broken clasp back onto your denture.', 155, 132),
  ('762', 'Replace/adding Clasp to denture - per clasp', 'We’ll add a new clasp to your denture for better grip and support.', 115, 133),
  ('763', 'Repair Broken base of a complete denture', 'We’ll repair a cracked or broken denture base so it functions like new.', 296, 134),
  ('768', 'Adding tooth to partial denture to replace an extracted or', 'We’ll add a replacement tooth to your partial denture after an extraction.', 242, 135),
  ('776', 'Impression - Denture repair/modification', 'We’ll take an impression to repair or adjust your denture accurately.', 83, 136),
  ('811', 'Passive removable appliance - per arch', 'We’ll fit a simple removable appliance for mild issues like minor movement or habit control.', 350, 137),
  ('821', 'Active Removable Appliance - per arch', 'We’ll provide a removable appliance that helps guide your teeth into better positions.', 1044, 138),
  ('823', 'Functional orthopaedic appliance - custom fabrication', 'We’ll custom make an orthopaedic appliance to guide jaw development and tooth positioning.', 1614, 139),
  ('825', 'Sequential plastic aligners - per arch', 'We’ll provide a series of clear aligners to gently move your teeth over time.', 3396, 140),
  ('831', 'Full arch banding - per arch', 'We’ll place bands around all teeth in an arch as part of your orthodontic treatment.', 3448, 141),
  ('843', '3 Expansion appliance - fixed - per arch', 'We’ll fit an expansion appliance to widen your arch and make room for crowded teeth.', 1417, 142),
  ('876', 'Repair of removable appliance - clasp, spring or tooth', 'We’ll repair parts of your removable appliance such as springs, clasps, or teeth.', 479, 143),
  ('878', 'Relining - removable appliance - processed', 'We’ll reline the inside of your appliance to improve comfort and fit.', 581, 144),
  ('911', 'Palliative care', 'We’ll provide emergency care to relieve pain or discomfort until full treatment is done.', 108, 145),
  ('915', 'After-hours callout', 'We’ll attend to urgent dental care needs outside normal clinic hours.', 110, 146),
  ('916', 'Travel to provide services', 'We’ll travel to your location to provide dental treatment if needed.', 110, 147),
  ('926', 'Individually made tray - medicament(s)', 'We’ll create a custom tray to apply special medication directly where it’s needed.', 146, 148),
  ('941', 'Local Anaesthesia', 'We’ll numb the treatment area to make sure you’re comfortable during the procedure.', 12, 149),
  ('942', 'Sedation - intravenous - per 30 minutes or part thereof', 'We’ll provide sedation through an IV to help you relax during longer procedures.', 338, 150),
  ('943', 'Sedation  - Inhalation  - per 30min or part thereof', 'We’ll use gas (happy gas) to help you feel calm and relaxed during treatment.', 144, 151),
  ('949', 'Treatment Under General Anaesthesia/Sedation', 'We’ll complete your treatment while you’re under general anaesthesia or sedation for maximum comfort.', 1867, 152),
  ('963', 'Clinical occlusal analysis, including muscle and joint palp', 'We’ll check how your bite fits, including muscles and jaw joints, to diagnose any issues.', 104, 153),
  ('965', 'Occlusal Splint', 'We’ll make a splint you wear at night to help reduce grinding, clenching, or jaw pain.', 680, 154),
  ('968', 'Occlusal Adjustment Following Occlusal Analysis  - per a', 'We’ll fine-tune your bite by adjusting your teeth for better alignment and comfort.', 116, 155),
  ('972', 'Repair/Addition - Occlusal Appliance', 'We’ll repair or add to your existing splint to keep it working properly.', 241, 156),
  ('981', 'Splinting & Stabilisation  - direct  - per tooth', 'We’ll stabilize a loose or injured tooth by splinting it to the neighbouring teeth.', 222, 157),
  ('982', 'Enamel Stripping  - per appointment', 'We’ll gently remove a bit of enamel to help with tooth crowding or bite issues.', 144, 158),
  ('984', 'Bi-Maxillary Oral Appliance for Diagnosed snoring and o', 'We’ll make a special device that helps reduce snoring or mild sleep apnea.', 1867, 159),
  ('986', 'Post Operative Care not otherwise included', 'We’ll provide aftercare to ensure proper healing and answer any concerns post-treatment.', 125, 160),
  ('990', 'Treatment not otherwise included (specify)', 'We’ll offer a treatment tailored to your unique case that isn’t listed elsewhere.', 208, 161),
  ('FTA', 'FTA - Fail To Attend', 'FTA - Fail To Attend', 50, 162),
  ('1', 'Toothmousse', 'Toothmousse', 33, 163),
  ('2', 'Late Cancellation / Fta Fee', 'Late Cancellation / Fta Fee', 50, 164),
  ('02', 'Poladay', 'Poladay', 80, 165),
  ('04', 'Superfloss', 'Superfloss', 6, 166),
  ('03', 'Pikster', 'Pikster', 7.5, 167)
on conflict (code) do nothing;

-- Text positions and table metrics, copied verbatim from
-- DEFAULT_TEMPLATE_SETTINGS so generated PDFs land identically.
insert into public.template_settings (id, settings) values
  (true, '{
  "patientNamePosition": {
    "x": 405,
    "y": 405
  },
  "patientNameFontSize": 58,
  "doctorNamePosition": {
    "x": 181,
    "y": 170
  },
  "doctorNameFontSize": 34,
  "doctorPhotoPosition": {
    "x": 51,
    "y": 139,
    "size": 109
  },
  "tableStartY": 820,
  "tableMarginX": 60,
  "rowHeight": 50,
  "maxRowsPerPage": 10
}'::jsonb)
on conflict (id) do nothing;

