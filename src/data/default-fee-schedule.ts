import type { FeeItem } from '@/types';

// Version of the fee schedule - increment this when updating item codes/fees
// Format: YYYYMMDD or semantic version
export const FEE_SCHEDULE_VERSION = '2025-12-18';

// Default fee schedule generated from treatment-plan-item-codes.csv
export const defaultFeeSchedule: FeeItem[] = [
  {
    code: '011',
    description: "We’ll do a thorough check of your teeth, gums, and mouth to understand your overall oral health and identify any concerns early.",
    fee: 84.0,
  },
  {
    code: '012',
    description: "A routine dental check-up to monitor your oral health and catch any issues before they become bigger problems.",
    fee: 76.0,
  },
  {
    code: '013',
    description: "A short dental exam focused on a specific issue or tooth that's bothering you.",
    fee: 70.0,
  },
  {
    code: '014',
    description: "We’ll sit down with you to discuss your dental concerns and smile goals, and explain the treatment options best suited for you.",
    fee: 84.0,
  },
  {
    code: '015',
    description: "A longer consultation for more detailed discussions, perfect for complex treatments or second opinions.",
    fee: 120.0,
  },
  {
    code: '018',
    description: "A formal written report about your dental condition, often needed for referrals, insurance, or records.",
    fee: 147.0,
  },
  {
    code: '022',
    description: "A small X-ray to look closely at a specific tooth or area to check for problems like decay or infection.",
    fee: 48.0,
  },
  {
    code: '037',
    description: "A full-mouth X-ray that lets us see your entire jaw and all teeth in one image – useful for wisdom teeth, implants, or overall checks.",
    fee: 133.0,
  },
  {
    code: '047',
    description: "A quick test of your saliva to assess your risk of tooth decay or gum disease and help us plan your care.",
    fee: 72.0,
  },
  {
    code: '061',
    description: "We’ll test the nerve of a tooth to see if it's alive or damaged – helpful for diagnosing pain or trauma.",
    fee: 45.0,
  },
  {
    code: '071',
    description: "We’ll take impressions of your teeth to make a model. This helps us plan your treatment and show you what your future smile might look like.",
    fee: 81.0,
  },
  {
    code: '072',
    description: "We’ll take close-up photos inside your mouth to track your progress and treatment results.",
    fee: 45.0,
  },
  {
    code: '073',
    description: "We’ll take photos of your smile and face to ensure everything stays balanced and looks natural.",
    fee: 53.0,
  },
  {
    code: '074',
    description: "We’ll create a mock-up of your expected results so you can preview your new smile before we begin.",
    fee: 115.0,
  },
  {
    code: '075',
    description: "We’ll scan your teeth digitally to create a precise 3D model. It’s quick, clean, and helps us plan accurately.",
    fee: 84.0,
  },
  {
    code: '111',
    description: "We’ll clean off surface stains and plaque to freshen up your smile and help keep your teeth healthy.",
    fee: 95.0,
  },
  {
    code: '113',
    description: "We’ll polish or reshape your current fillings to make them smoother, more comfortable, and look better.",
    fee: 69.0,
  },
  {
    code: '114',
    description: "We’ll remove tartar and hard build-up from your teeth to reduce inflammation and improve gum health.",
    fee: 127.0,
  },
  {
    code: '115',
    description: "A follow-up cleaning to remove remaining tartar and maintain your gum health.",
    fee: 145.0,
  },
  {
    code: '116',
    description: "We’ll gently smooth out surface stains or white spots on your teeth for a more even appearance.",
    fee: 52.0,
  },
  {
    code: '117',
    description: "We’ll whiten the inside of a darkened tooth that’s had root canal treatment to match your other teeth.",
    fee: 352.0,
  },
  {
    code: '118',
    description: "We’ll safely whiten your teeth to brighten your smile and boost your confidence.",
    fee: 55.0,
  },
  {
    code: '119',
    description: "We’ll give you custom-made trays and gel so you can whiten your teeth at home, gradually and comfortably.",
    fee: 197.5,
  },
  {
    code: '121',
    description: "We’ll apply fluoride or a similar agent to your teeth to help prevent cavities and strengthen enamel.",
    fee: 38.0,
  },
  {
    code: '122',
    description: "We’ll recommend special at-home products to help protect and remineralize your teeth between visits.",
    fee: 53.0,
  },
  {
    code: '123',
    description: "We’ll apply a highly concentrated treatment to strengthen your teeth and reduce the risk of cavities.",
    fee: 26.0,
  },
  {
    code: '131',
    description: "We’ll apply a highly concentrated treatment to strengthen your teeth and reduce the risk of cavities.",
    fee: 53.0,
  },
  {
    code: '141',
    description: "We’ll teach you the best way to brush and floss so you can keep your mouth as healthy as possible between visits.",
    fee: 55.0,
  },
  {
    code: '142',
    description: "We’ll help you understand how tobacco affects your oral health and support you in quitting, if needed",
    fee: 55.0,
  },
  {
    code: '151',
    description: "We’ll make a custom-fit mouthguard to protect your teeth during sports or while you sleep",
    fee: 260.0,
  },
  {
    code: '161',
    description: "We’ll seal the grooves of your back teeth to protect them from cavities, especially helpful for kids or cavity-prone patients",
    fee: 62.0,
  },
  {
    code: '165',
    description: "We’ll apply a special treatment to help reduce sensitivity and make eating or drinking more comfortable.",
    fee: 42.0,
  },
  {
    code: '171',
    description: "We’ll gently reshape a tooth to improve its look or help with your bite.",
    fee: 80.0,
  },
  {
    code: '213',
    description: "We’ll treat gum infections quickly to relieve pain and prevent further damage to your gums or teeth.",
    fee: 141.0,
  },
  {
    code: '221',
    description: "We’ll do a detailed exam of your gums to check for signs of gum disease and plan the right care.",
    fee: 70.0,
  },
  {
    code: '222',
    description: "We’ll clean around your teeth and under your gums to remove bacteria and help your gums heal.",
    fee: 48.0,
  },
  {
    code: '223',
    description: "We’ll treat infected tissue around implants to prevent bone loss and support healing.",
    fee: 194.0,
  },
  {
    code: '232',
    description: "We’ll gently lift the gums for a deep clean around the roots of your teeth if gum disease is advanced.",
    fee: 345.0,
  },
  {
    code: '250',
    description: "We’ll clean deep under the gums in one section of your mouth to stop gum disease from progressing.",
    fee: 260.0,
  },
  {
    code: '251',
    description: "We’ll do regular cleanings and checks to maintain your gum health after periodontal treatment.",
    fee: 232.0,
  },
  {
    code: '311',
    description: "We’ll gently remove a tooth that can’t be saved or is causing problems like pain or crowding.",
    fee: 225.0,
  },
  {
    code: '314',
    description: "We’ll section the tooth to remove it in parts when a simple extraction isn’t enough.",
    fee: 290.0,
  },
  {
    code: '322',
    description: "We’ll surgically remove a tooth that hasn’t come through properly, usually done gently and with care.",
    fee: 322.0,
  },
  {
    code: '324',
    description: "We’ll remove a problem tooth that requires both cutting and lifting techniques for safe removal.",
    fee: 440.0,
  },
  {
    code: '332',
    description: "A surgery to reshape the bone in your jaw, usually to help prepare for dentures or implants.",
    fee: 365.0,
  },
  {
    code: '378',
    description: "We’ll carefully remove a foreign object (like a splinter or piece of metal) from your gums or mouth.",
    fee: 174.0,
  },
  {
    code: '379',
    description: "We’ll treat a fluid-filled swelling by opening and draining it to relieve pressure and prevent infection.",
    fee: 180.0,
  },
  {
    code: '381',
    description: "We’ll gently uncover a tooth that hasn’t come through the gum properly so it can erupt naturally or be moved with braces.",
    fee: 230.0,
  },
  {
    code: '384',
    description: "We’ll carefully reposition a tooth that’s been pushed out of place due to injury to help it heal correctly.",
    fee: 122.0,
  },
  {
    code: '386',
    description: "We’ll apply a splint to stabilize a loose or injured tooth so it stays in position while healing.",
    fee: 243.0,
  },
  {
    code: '391',
    description: "We’ll remove or reshape the small fold of tissue (frenum) under your tongue or lip to improve comfort or function.",
    fee: 296.0,
  },
  {
    code: '392',
    description: "We’ll drain an infection or abscess to relieve pain and allow healing.",
    fee: 130.0,
  },
  {
    code: '411',
    description: "We’ll place a protective dressing over a small exposure in the tooth pulp to help it heal and avoid root canal treatment.",
    fee: 68.0,
  },
  {
    code: '414',
    description: "We’ll remove the top portion of the tooth’s nerve and place a medication to preserve the rest, often used in baby teeth.",
    fee: 161.0,
  },
  {
    code: '415',
    description: "We’ll clean and shape the root canal system of a tooth to prepare it for filling, usually due to infection or damage.",
    fee: 305.0,
  },
  {
    code: '416',
    description: "We’ll do a full cleaning of the root canals in a tooth with multiple roots, preparing it for sealing.",
    fee: 160.0,
  },
  {
    code: '417',
    description: "We’ll seal the root canal of a tooth that had a single canal, completing the root canal treatment.",
    fee: 303.0,
  },
  {
    code: '418',
    description: "We’ll fill and seal any additional root canals in the same tooth as part of a complete root canal procedure.",
    fee: 187.0,
  },
  {
    code: '419',
    description: "We’ll remove infected or dead tissue from inside the tooth to relieve pain and stop infection.",
    fee: 350.0,
  },
  {
    code: '451',
    description: "We’ll remove an old root canal filling if re-treatment is needed due to persistent infection or failure.",
    fee: 175.0,
  },
  {
    code: '452',
    description: "We’ll take out a post or crown that’s cemented into a tooth if replacement or retreatment is needed.",
    fee: 352.0,
  },
  {
    code: '455',
    description: "This is a follow-up appointment to flush out and medicate the root canal before completing treatment.",
    fee: 188.0,
  },
  {
    code: '521',
    description: "We’ll repair a small part of a front tooth using tooth-coloured material to restore function and appearance.",
    fee: 213.0,
  },
  {
    code: '522',
    description: "We’ll restore two surfaces of a front tooth using tooth-coloured filling material for natural results.",
    fee: 230.0,
  },
  {
    code: '523',
    description: "We’ll rebuild three surfaces of a front tooth with composite resin to restore structure and appearance.",
    fee: 266.0,
  },
  {
    code: '524',
    description: "We’ll restore four surfaces of a front tooth, typically when a larger area has been damaged or decayed.",
    fee: 320.0,
  },
  {
    code: '525',
    description: "We’ll repair almost the entire surface of a front tooth using high-quality tooth-coloured material.",
    fee: 365.0,
  },
  {
    code: '526',
    description: "We’ll apply a thin layer of composite on the front of a tooth to improve its colour, shape, or size.",
    fee: 469.0,
  },
  {
    code: '531',
    description: "We’ll fix a back tooth with a small composite filling that blends in with your natural teeth.",
    fee: 214.0,
  },
  {
    code: '532',
    description: "We’ll restore two sides of a back tooth, usually to repair damage from decay or wear.",
    fee: 255.0,
  },
  {
    code: '533',
    description: "We’ll rebuild three surfaces of a back tooth for both strength and a natural look.",
    fee: 299.0,
  },
  {
    code: '534',
    description: "We’ll restore four surfaces of a molar or premolar tooth for large cavities or breaks.",
    fee: 341.0,
  },
  {
    code: '535',
    description: "We’ll repair nearly the entire chewing surface of a back tooth using durable tooth-coloured material.",
    fee: 384.0,
  },
  {
    code: '536',
    description: "We’ll apply a veneer on the back tooth using composite resin to improve function or aesthetics.",
    fee: 458.0,
  },
  {
    code: '551',
    description: "We’ll place a custom-made indirect filling on one surface for added strength and longevity.",
    fee: 1106.0,
  },
  {
    code: '552',
    description: "We’ll restore two surfaces of a tooth using a lab-made filling for improved durability.",
    fee: 1275.0,
  },
  {
    code: '553',
    description: "We’ll rebuild three surfaces of a tooth using a high-strength indirect restoration.",
    fee: 1456.0,
  },
  {
    code: '554',
    description: "We’ll repair most of a tooth with a custom-made piece that’s cemented into place.",
    fee: 1638.0,
  },
  {
    code: '555',
    description: "We’ll restore nearly the full surface of a tooth with a long-lasting, aesthetic filling.",
    fee: 1805.0,
  },
  {
    code: '556',
    description: "We’ll place a custom-made porcelain or composite veneer over your tooth to enhance its appearance.",
    fee: 1638.0,
  },
  {
    code: '572',
    description: "We’ll place a temporary filling to protect the tooth until a permanent restoration is completed.",
    fee: 183.0,
  },
  {
    code: '574',
    description: "We’ll use a metal band to help shape and support a tooth during restoration or filling.",
    fee: 146.0,
  },
  {
    code: '575',
    description: "We’ll place a small metal pin to help secure the filling material inside a heavily damaged tooth.",
    fee: 55.0,
  },
  {
    code: '577',
    description: "We’ll cover the tooth’s cusp with filling material to strengthen it and restore function.",
    fee: 56.0,
  },
  {
    code: '578',
    description: "We’ll restore a chipped or broken corner of a front tooth so it looks natural again.",
    fee: 56.0,
  },
  {
    code: '579',
    description: "We’ll bond a broken piece of your tooth back in place using special dental adhesive.",
    fee: 208.0,
  },
  {
    code: '586',
    description: "We’ll place a pre-formed metal crown to protect and restore a damaged tooth.",
    fee: 588.0,
  },
  {
    code: '587',
    description: "We’ll fit a thin metal crown over the tooth with minimal preparation needed.",
    fee: 600.0,
  },
  {
    code: '588',
    description: "We’ll place a pre-formed tooth-coloured crown to restore both function and appearance.",
    fee: 1148.0,
  },
  {
    code: '595',
    description: "We’ll remove a crown, bridge, or other restoration that needs replacement or adjustment.",
    fee: 161.0,
  },
  {
    code: '596',
    description: "We’ll re-cement a crown or bridge that has come loose to keep it secure.",
    fee: 142.0,
  },
  {
    code: '597',
    description: "We’ll place a support post directly into the root of a tooth to help hold a restoration in place.",
    fee: 238.0,
  },
  {
    code: '611',
    description: "We’ll create a full acrylic crown in the lab and cement it to your tooth for protection and aesthetics.",
    fee: 1941.0,
  },
  {
    code: '613',
    description: "We’ll fit a full crown made from ceramic or other non-metal material for a natural look.",
    fee: 1750.0,
  },
  {
    code: '615',
    description: "We’ll use a crown with a layered ceramic coating for a more aesthetic finish.",
    fee: 1941.0,
  },
  {
    code: '618',
    description: "We’ll place a metal crown to restore strength and durability, often for back teeth.",
    fee: 1941.0,
  },
  {
    code: '625',
    description: "We’ll build a post and core inside your tooth to support a crown securely.",
    fee: 570.0,
  },
  {
    code: '627',
    description: "We’ll place a post and cap over the root of a tooth to stabilize it and support a crown.",
    fee: 306.0,
  },
  {
    code: '629',
    description: "We’ll use a post and cap system to strengthen a damaged tooth for further restoration.",
    fee: 255.0,
  },
  {
    code: '631',
    description: "We’ll place a temporary crown to protect your tooth until the final crown is ready.",
    fee: 289.0,
  },
  {
    code: '632',
    description: "We’ll make a temporary bridge tooth to fill a gap while your permanent one is made.",
    fee: 327.0,
  },
  {
    code: '633',
    description: "We’ll place a temporary abutment on your implant while the final restoration is being prepared.",
    fee: 428.0,
  },
  {
    code: '634',
    description: "We’ll attach a temporary crown to your implant so you can function and smile comfortably.",
    fee: 517.0,
  },
  {
    code: '643',
    description: "We’ll add a bridge tooth (pontic) to fill a gap, supported by crowns on nearby teeth.",
    fee: 1528.0,
  },
  {
    code: '644',
    description: "We’ll use a semi-fixed attachment to link parts of your dental restoration securely.",
    fee: 155.0,
  },
  {
    code: '651',
    description: "We’ll re-cement a loose crown or veneer so it stays in place properly.",
    fee: 202.0,
  },
  {
    code: '661',
    description: "We’ll place the abutment — the piece that connects your implant to the final tooth.",
    fee: 1136.0,
  },
  {
    code: '665',
    description: "We’ll attach a removable denture to implants using a resin base for stability and comfort.",
    fee: 2217.0,
  },
  {
    code: '666',
    description: "We’ll fix a metal-based denture onto implants for a secure and long-lasting result.",
    fee: 4088.0,
  },
  {
    code: '667',
    description: "We’ll attach a removable metal-based denture to implants for improved strength and stability.",
    fee: 3638.0,
  },
  {
    code: '672',
    description: "We’ll fit a custom crown over an implant, blending with your natural teeth.",
    fee: 2421.0,
  },
  {
    code: '688',
    description: "We’ll place an implant into your jawbone to replace a missing tooth root.",
    fee: 3033.0,
  },
  {
    code: '711',
    description: "We’ll create a full upper denture to restore your smile and improve function.",
    fee: 1848.0,
  },
  {
    code: '712',
    description: "We’ll make a full lower denture to help with chewing, speech, and confidence.",
    fee: 1848.0,
  },
  {
    code: '713',
    description: "We’ll give you a temporary upper denture while your permanent one is being made.",
    fee: 702.0,
  },
  {
    code: '714',
    description: "We’ll provide a temporary lower denture until the final one is ready.",
    fee: 702.0,
  },
  {
    code: '719',
    description: "We’ll make both upper and lower dentures to fully restore your smile and bite.",
    fee: 3465.0,
  },
  {
    code: '721',
    description: "We’ll create a partial upper denture using a resin base to replace missing teeth.",
    fee: 1560.0,
  },
  {
    code: '722',
    description: "We’ll provide a lower partial denture with a resin base to fill gaps comfortably.",
    fee: 1560.0,
  },
  {
    code: '727',
    description: "We’ll make a stronger partial upper denture with a cast metal frame for support.",
    fee: 2195.0,
  },
  {
    code: '728',
    description: "We’ll provide a cast metal partial lower denture for better fit and durability.",
    fee: 1931.0,
  },
  {
    code: '731',
    description: "We’ll make or adjust a retainer to help maintain your tooth alignment.",
    fee: 78.0,
  },
  {
    code: '732',
    description: "We’ll add a resting component to support your denture and improve comfort.",
    fee: 35.0,
  },
  {
    code: '733',
    description: "We’ll add or adjust teeth on your partial denture to improve its function.",
    fee: 68.0,
  },
  {
    code: '736',
    description: "We’ll place a temporary tooth immediately after extraction so your smile stays intact.",
    fee: 17.0,
  },
  {
    code: '737',
    description: "We’ll add a soft lining to your denture for extra comfort, especially if gums are sore.",
    fee: 347.0,
  },
  {
    code: '741',
    description: "We’ll adjust your denture to improve its fit and relieve any pressure points.",
    fee: 88.0,
  },
  {
    code: '743',
    description: "We’ll reline the inside of your full denture using lab-processed materials for better fit.",
    fee: 636.0,
  },
  {
    code: '744',
    description: "We’ll reline your partial denture in the lab to make it fit better.",
    fee: 461.0,
  },
  {
    code: '751',
    description: "We’ll reline your complete denture directly in the clinic for immediate improvement.",
    fee: 388.0,
  },
  {
    code: '752',
    description: "We’ll reline your partial denture directly during your appointment.",
    fee: 453.0,
  },
  {
    code: '754',
    description: "We’ll modify the base of your denture to improve its fit or comfort.",
    fee: 230.0,
  },
  {
    code: '761',
    description: "We’ll reattach a broken clasp back onto your denture.",
    fee: 155.0,
  },
  {
    code: '762',
    description: "We’ll add a new clasp to your denture for better grip and support.",
    fee: 115.0,
  },
  {
    code: '763',
    description: "We’ll repair a cracked or broken denture base so it functions like new.",
    fee: 296.0,
  },
  {
    code: '768',
    description: "We’ll add a replacement tooth to your partial denture after an extraction.",
    fee: 242.0,
  },
  {
    code: '776',
    description: "We’ll take an impression to repair or adjust your denture accurately.",
    fee: 83.0,
  },
  {
    code: '811',
    description: "We’ll fit a simple removable appliance for mild issues like minor movement or habit control.",
    fee: 350.0,
  },
  {
    code: '821',
    description: "We’ll provide a removable appliance that helps guide your teeth into better positions.",
    fee: 1044.0,
  },
  {
    code: '823',
    description: "We’ll custom make an orthopaedic appliance to guide jaw development and tooth positioning.",
    fee: 1614.0,
  },
  {
    code: '825',
    description: "We’ll provide a series of clear aligners to gently move your teeth over time.",
    fee: 3396.0,
  },
  {
    code: '831',
    description: "We’ll place bands around all teeth in an arch as part of your orthodontic treatment.",
    fee: 3448.0,
  },
  {
    code: '843',
    description: "We’ll fit an expansion appliance to widen your arch and make room for crowded teeth.",
    fee: 1417.0,
  },
  {
    code: '876',
    description: "We’ll repair parts of your removable appliance such as springs, clasps, or teeth.",
    fee: 479.0,
  },
  {
    code: '878',
    description: "We’ll reline the inside of your appliance to improve comfort and fit.",
    fee: 581.0,
  },
  {
    code: '911',
    description: "We’ll provide emergency care to relieve pain or discomfort until full treatment is done.",
    fee: 108.0,
  },
  {
    code: '915',
    description: "We’ll attend to urgent dental care needs outside normal clinic hours.",
    fee: 110.0,
  },
  {
    code: '916',
    description: "We’ll travel to your location to provide dental treatment if needed.",
    fee: 110.0,
  },
  {
    code: '926',
    description: "We’ll create a custom tray to apply special medication directly where it’s needed.",
    fee: 146.0,
  },
  {
    code: '941',
    description: "We’ll numb the treatment area to make sure you’re comfortable during the procedure.",
    fee: 12.0,
  },
  {
    code: '942',
    description: "We’ll provide sedation through an IV to help you relax during longer procedures.",
    fee: 338.0,
  },
  {
    code: '943',
    description: "We’ll use gas (happy gas) to help you feel calm and relaxed during treatment.",
    fee: 144.0,
  },
  {
    code: '949',
    description: "We’ll complete your treatment while you’re under general anaesthesia or sedation for maximum comfort.",
    fee: 1867.0,
  },
  {
    code: '963',
    description: "We’ll check how your bite fits, including muscles and jaw joints, to diagnose any issues.",
    fee: 104.0,
  },
  {
    code: '965',
    description: "We’ll make a splint you wear at night to help reduce grinding, clenching, or jaw pain.",
    fee: 680.0,
  },
  {
    code: '968',
    description: "We’ll fine-tune your bite by adjusting your teeth for better alignment and comfort.",
    fee: 116.0,
  },
  {
    code: '972',
    description: "We’ll repair or add to your existing splint to keep it working properly.",
    fee: 241.0,
  },
  {
    code: '981',
    description: "We’ll stabilize a loose or injured tooth by splinting it to the neighbouring teeth.",
    fee: 222.0,
  },
  {
    code: '982',
    description: "We’ll gently remove a bit of enamel to help with tooth crowding or bite issues.",
    fee: 144.0,
  },
  {
    code: '984',
    description: "We’ll make a special device that helps reduce snoring or mild sleep apnea.",
    fee: 1867.0,
  },
  {
    code: '986',
    description: "We’ll provide aftercare to ensure proper healing and answer any concerns post-treatment.",
    fee: 125.0,
  },
  {
    code: '990',
    description: "We’ll offer a treatment tailored to your unique case that isn’t listed elsewhere.",
    fee: 208.0,
  },
  {
    code: 'FTA',
    description: "FTA - Fail To Attend",
    fee: 50.0,
  },
  {
    code: '1',
    description: "Toothmousse",
    fee: 33.0,
  },
  {
    code: '2',
    description: "Late Cancellation / Fta Fee",
    fee: 50.0,
  },
  {
    code: '02',
    description: "Poladay",
    fee: 80.0,
  },
  {
    code: '04',
    description: "Superfloss",
    fee: 6.0,
  },
  {
    code: '03',
    description: "Pikster",
    fee: 7.5,
  },
];
