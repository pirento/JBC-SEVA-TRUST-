// ========================================
// TRUST PROFILE
// ========================================
//
// Facts from "JBC Seva Trust — Profile, Work Plan & Governance".
// Registration no., PAN, 12A/80G and helpline are not public yet;
// add them here only once they are real. Targets are goals, not
// results achieved, and must be shown as such.
// ========================================

const programmes = [
  {
    slug: "green-earth",
    donation: {
      purposes: ["Tree plantation", "Pond clean-up and rainwater harvesting", "Plastic clean-up drives", "Wherever Green Earth needs it"],
      amounts: [501, 1100, 2100, 5100],
    },
    icon: "tree",
    title: "Green Earth",
    hindi: "हरित धरा",
    area: "Tree plantation and environment",
    summary:
      "Native shade and fruit trees on village, school and roadside land, each one geotagged and looked after for three years.",
    goal: "Goal: plant 10,000 native trees such as neem, peepal and fruit species.",
    details: [
      "Every tree is geotagged, and a local caretaker looks after it for 3 years. We report survival to donors.",
      "Village pond clean-up and rainwater harvesting.",
      "Drip irrigation tie-ups with farmers for plantation sites.",
      "Plastic clean-up drives at riverbanks and water bodies, with cloth-bag distribution.",
      "Weekend volunteer plantation drives, including a monsoon green-belt drive.",
    ],
    year1: "First plantation drive with geotagging",
    later: "Scale toward 10,000 trees; ponds",
    measure: "Trees alive at 12 and 36 months",
  },
  {
    slug: "anand-dham",
    donation: {
      purposes: ["Meals for elders (annadaan)", "Medicines and health check-ups", "Blankets and clothing", "Eye camp", "Wherever Anand Dham needs it"],
      amounts: [501, 1100, 2100, 5100],
      sevaDate: true,
    },
    icon: "home",
    title: "Anand Dham",
    hindi: "आनंद धाम",
    area: "Old age home",
    summary:
      "Free shelter for abandoned and destitute senior citizens, with three meals a day, health care and company.",
    details: [
      "Free shelter for abandoned and destitute senior citizens.",
      "Three meals a day, regular health check-ups, on-call nursing and physiotherapy.",
      "Eye camps (cataract screening, spectacles) and seasonal blanket distribution.",
      "Daily bhajan, cultural events and volunteer companionship days.",
      "Solar power for the home and its medical equipment, when funds allow.",
    ],
    year1: "Find a building; register the home",
    later: "Full residential care with nursing",
    measure: "Residents served, health check-ups",
  },
  {
    slug: "kanyadaan",
    donation: {
      purposes: ["Household starter kit", "Sewing machine and tailoring training", "Mass marriage ceremony", "Wherever Kanyadaan needs it"],
      amounts: [1100, 2100, 5100, 11000],
    },
    icon: "rings",
    title: "Kanyadaan",
    hindi: "कन्यादान",
    area: "Marriage support for girls from poor families",
    summary:
      "Mass marriage ceremonies with full rites, a starter kit for each couple, and a sewing machine and training so every bride can earn.",
    details: [
      "Mass marriage ceremonies (Subhagya drive) with full traditional rites and a community feast.",
      "A household starter kit for each couple.",
      "A sewing machine and tailoring training for each bride, so she can earn independently.",
      "Age proof for every couple (bride at least 18, groom at least 21) and written consent of both, under the Prohibition of Child Marriage Act, 2006.",
      "Linked with the UP government's mass marriage scheme where eligible.",
    ],
    year1: "First mass marriage with skill kits",
    later: "Annual ceremony; tailoring centre",
    measure: "Couples supported, brides earning",
  },
  {
    slug: "vidya-poshan",
    donation: {
      purposes: ["School kit (bag, books, uniform)", "Evening tutoring", "Meals for children", "Scholarships", "Wherever Vidya and Poshan needs it"],
      amounts: [501, 1100, 2100, 5100],
    },
    icon: "book",
    title: "Vidya and Poshan",
    hindi: "विद्या और पोषण",
    area: "Child education and nutrition",
    summary:
      "School kits, evening tutoring and a healthy meal, so that children from poor families stay in school.",
    details: [
      "Free school bags, books, uniforms, shoes and stationery.",
      "Evening remedial tutoring and digital or tablet-based classes at community learning centres.",
      "A healthy breakfast or lunch for enrolled children.",
      "Scholarships for top students, learning kits, solar lamps and science exhibitions.",
    ],
    year1: "One learning centre; school kits",
    later: "More centres; daily meals",
    measure: "Enrolment, retention, meals served",
  },
  {
    slug: "temple",
    donation: {
      purposes: ["Temple construction fund", "Daily aarti and bhog", "Prasad distribution", "General temple seva"],
      amounts: [251, 501, 1100, 2100],
      sevaDate: true,
      gotra: true,
      religious: true,
    },
    icon: "temple",
    title: "Community Temple",
    hindi: "सामुदायिक मंदिर",
    area: "Place of worship for the village",
    summary:
      "A temple for worship, meditation, daily aarti and free prasad, built from its own separate fund.",
    details: [
      "A place for worship, meditation, daily aarti and free prasad distribution.",
      "Temple donations are kept in a separate fund and never mixed with the charitable programmes.",
    ],
    year1: "Land, design and fund plan",
    later: "Construction in phases",
    measure: "Funds raised vs. spent",
  },
];

const GENERAL_CAUSE = "Where Most Needed";

// Donation page for "Where Most Needed" (not a programme of its own)
const generalDonation = {
  slug: "general",
  icon: "heart",
  title: GENERAL_CAUSE,
  area: "Used by the trustees where the need is most urgent",
  donation: { purposes: ["General donation"], amounts: [501, 1100, 2100, 5100] },
};

const dedicationTypes = ["In memory of", "In honour of", "On the occasion of"];

// Shown on receipts; never claim 80G before approval is received
const taxNotes = {
  default: "80G tax-exemption receipts will be issued only after the Trust receives 80G approval.",
  religious: "Kept in the separate Temple Fund. Temple donations are generally not eligible for 80G deduction.",
};

// Causes a donor can pick; earmarked money goes only to that cause
const donationCauses = [GENERAL_CAUSE, ...programmes.map((p) => p.title)];

module.exports = {
  name: "JBC Seva Trust",
  tagline: "Serving humanity. Preserving nature.",
  taglineHindi: "मानवता की सेवा, प्रकृति का संरक्षण",
  vision:
    "True seva is honouring the dignity in every living being and every inch of our Earth.",
  mission:
    "To be present on the ground with the people who need help most — forgotten elders, poor families with daughters to marry, children at risk of dropping out — while restoring green cover in our villages, with every rupee accounted for.",
  legalForm: "Public Charitable Trust",
  location: "Basti, Uttar Pradesh, India",
  trustees: [
    {
      name: "Jang Bahadur Chaudhary",
      role: "Founder Trustee",
      work: "Overall direction, village and panchayat outreach, Anand Dham and the temple project.",
    },
    {
      name: "Ravikant Soni",
      role: "Managing Trustee",
      work: "Operations, accounts and compliance, website and donor records, volunteer drives.",
    },
  ],
  programmes,
  GENERAL_CAUSE,
  donationCauses,
  generalDonation,
  dedicationTypes,
  taxNotes,
  // Every donation page: "Where Most Needed" first, then the programmes
  donationPages: [generalDonation, ...programmes],
  volunteerAreas: [
    "Tree plantation",
    "Elder companionship",
    "Wedding logistics",
    "Teaching children",
    "Medical camps",
    "Office and accounts",
  ],
  volunteerAvailability: ["Weekends", "Weekdays", "Occasionally, for events"],
  enquiryTypes: [
    "General enquiry",
    "Volunteer interest",
    "CSR or major donation",
    "Event support",
  ],
};
