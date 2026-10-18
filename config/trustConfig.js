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
    icon: "🌳",
    title: "Green Earth",
    summary:
      "Planting native shade and fruit trees on village, school and roadside land. Every tree is geotagged and cared for by a local caretaker for 3 years.",
    points: ["Tree Plantation", "Pond Clean-up", "Rainwater Harvesting", "Plastic Clean-up Drives"],
  },
  {
    slug: "anand-dham",
    icon: "🏡",
    title: "Anand Dham",
    summary:
      "A free home for abandoned and destitute senior citizens, with three meals a day, health check-ups and companionship.",
    points: ["Shelter & Meals", "Health Check-ups", "Eye Camps", "Blanket Distribution"],
  },
  {
    slug: "kanyadaan",
    icon: "💐",
    title: "Kanyadaan",
    summary:
      "Marriage support for girls from poor families, with a starter kit and tailoring training. Age proof and consent of both are checked for every couple.",
    points: ["Mass Marriage Ceremonies", "Household Starter Kits", "Sewing Machines", "Tailoring Training"],
  },
  {
    slug: "vidya-poshan",
    icon: "📚",
    title: "Vidya and Poshan",
    summary:
      "Education and nutrition for children so that no child drops out of school.",
    points: ["School Kits & Uniforms", "Evening Tutoring", "Healthy Meals", "Scholarships"],
  },
  {
    slug: "temple",
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
