// ========================================
// TRUST PROFILE
// ========================================
//
// Facts from "JBC Seva Trust — Profile, Work Plan & Governance".
// Registration no., PAN, 12A/80G and helpline are not public yet;
// add them here only once they are real.
// ========================================

const programmes = [
  {
    slug: "green-earth",
    tone: "green",
    icon: "🌳",
    title: "Green Earth",
    summary:
      "Planting native shade and fruit trees on village, school and roadside land. Every tree is geotagged and cared for by a local caretaker for 3 years.",
    points: ["Tree Plantation", "Pond Clean-up", "Rainwater Harvesting", "Plastic Clean-up Drives"],
  },
  {
    slug: "anand-dham",
    tone: "saffron",
    icon: "🏡",
    title: "Anand Dham",
    summary:
      "A free home for abandoned and destitute senior citizens, with three meals a day, health check-ups and companionship.",
    points: ["Shelter & Meals", "Health Check-ups", "Eye Camps", "Blanket Distribution"],
  },
  {
    slug: "kanyadaan",
    tone: "rose",
    icon: "💐",
    title: "Kanyadaan",
    summary:
      "Marriage support for girls from poor families, with a starter kit and tailoring training. Age proof and consent of both are checked for every couple.",
    points: ["Mass Marriage Ceremonies", "Household Starter Kits", "Sewing Machines", "Tailoring Training"],
  },
  {
    slug: "vidya-poshan",
    tone: "blue",
    icon: "📚",
    title: "Vidya and Poshan",
    summary:
      "Education and nutrition for children so that no child drops out of school.",
    points: ["School Kits & Uniforms", "Evening Tutoring", "Healthy Meals", "Scholarships"],
  },
  {
    slug: "temple",
    tone: "amber",
    icon: "🛕",
    title: "Community Temple",
    summary:
      "A place for worship, meditation, daily aarti and free prasad, run from a separate fund.",
    points: ["Temple Construction", "Daily Aarti", "Prasad Distribution", "Meditation Space"],
  },
];

const GENERAL_CAUSE = "Where Most Needed";

// Causes a donor can pick; earmarked money goes only to that cause
const donationCauses = [GENERAL_CAUSE, ...programmes.map((p) => p.title)];

module.exports = {
  name: "JBC Seva Trust",
  tagline: "Serving humanity. Preserving nature.",
  taglineHindi: "मानवता की सेवा, प्रकृति का संरक्षण",
  vision:
    "True seva is honouring the dignity in every living being and every inch of our Earth.",
  // Targets from the work plan: goals, not results achieved
  goals: [
    { value: "10,000", label: "native trees to plant (goal)" },
    { value: "3 years", label: "of care for every tree planted" },
    { value: "5", label: "programmes run by the trust" },
    { value: "100%", label: "of earmarked money used for its cause" },
  ],
  legalForm: "Public Charitable Trust",
  location: "Basti, Uttar Pradesh, India",
  trustees: [
    { name: "Jang Bahadur Chaudhary", role: "Founder Trustee" },
    { name: "Ravikant Soni", role: "Managing Trustee" },
  ],
  programmes,
  GENERAL_CAUSE,
  donationCauses,
};
