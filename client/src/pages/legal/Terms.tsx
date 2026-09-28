import { Link } from "react-router-dom";
import { INSTAGRAM_URL } from "../../lib/site";
import { LegalPageLayout, type LegalSectionData } from "./LegalLayout";

const SECTIONS: LegalSectionData[] = [
  {
    heading: "Introduction",
    paragraphs: [
      "These Terms & Conditions govern your use of Mero Note, a study library that organizes BSc CSIT semesters, subjects, topics, and study resources. By using Mero Note, you agree to these terms.",
    ],
  },
  {
    heading: "Acceptance of Terms",
    paragraphs: [
      "By creating an account, logging in, or browsing study resources, you confirm that you accept these terms. If you do not agree, please do not use the service.",
    ],
  },
  {
    heading: "Account Registration",
    paragraphs: [
      "Some parts of Mero Note, including semesters, subjects, and the resource library, require an account. You agree to provide accurate information during registration and to keep your login credentials secure.",
    ],
  },
  {
    heading: "User Responsibilities",
    paragraphs: [
      "You are responsible for activity under your account, for keeping your credentials private, and for using study materials for your own learning. Please sign out when using shared devices.",
    ],
  },
  {
    heading: "Acceptable Use",
    paragraphs: [
      "Mero Note is intended for personal, educational study. You agree to use the reader, bookmarks, progress tracking, and downloads for lawful study purposes and to respect other users and content sources.",
    ],
  },
  {
    heading: "Educational Content",
    paragraphs: [
      "Mero Note organizes books, notes, questions, practicals, and past papers to support CSIT study. Content is provided for learning and revision; it does not replace your college instruction, syllabus, or official notices.",
    ],
  },
  {
    heading: "Downloads & Offline Use",
    paragraphs: [
      "You may download resources you have access to for personal offline study on your own devices. Downloaded files are for your own learning and should not be re-uploaded publicly or redistributed without permission.",
    ],
  },
  {
    heading: "Intellectual Property",
    paragraphs: [
      "The Mero Note name, logo, and app experience belong to Mero Note. Study materials may include third-party educational content that remains the property of its respective owners, as described in the Copyright & Content Policy.",
    ],
  },
  {
    heading: "Prohibited Activities",
    paragraphs: [
      "To keep the library reliable for everyone, misuse of the service is not allowed.",
    ],
    bullets: [
      "Attempting to access accounts, admin areas, or resources without permission.",
      "Copying, scraping, or redistributing library content in bulk.",
      "Uploading or sharing unlawful, harmful, or infringing material.",
      "Interfering with the security, availability, or normal operation of the service.",
    ],
  },
  {
    heading: "Service Availability",
    paragraphs: [
      "Mero Note aims to keep the study library available, but maintenance, updates, connectivity issues, or hosting changes may cause temporary interruptions. Offline downloads you have already saved remain on your device during such periods.",
    ],
  },
  {
    heading: "Changes to the Service",
    paragraphs: [
      "Study resources, features, and organization may be added, updated, or removed over time as the library improves. Mero Note may update these terms, and continued use after changes take effect means you accept the updated terms.",
    ],
  },
  {
    heading: "Account Suspension & Termination",
    paragraphs: [
      "Accounts involved in misuse, security risks, or violations of these terms may be restricted or suspended. You may stop using Mero Note at any time.",
    ],
  },
  {
    heading: "Limitation of Liability",
    paragraphs: [
      "Mero Note is provided for educational support. To the extent permitted by applicable law, Mero Note is not liable for study outcomes, exam results, or interruptions beyond reasonable control. Your own judgment and official college guidance remain the authority for academic decisions.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "For questions about these terms, reach out through the official Mero Note Instagram profile linked below.",
    ],
  },
];

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      intro="The rules for using your Mero Note account and the CSIT study library."
      updated="September 2026"
      sections={SECTIONS}
    >
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Contact on Instagram
        </a>
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to Home
        </Link>
      </div>
    </LegalPageLayout>
  );
}
