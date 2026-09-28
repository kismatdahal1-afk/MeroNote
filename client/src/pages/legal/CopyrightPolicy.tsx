import { LegalPageLayout, type LegalSectionData } from "./LegalLayout";

const SECTIONS: LegalSectionData[] = [
  {
    heading: "Purpose",
    paragraphs: [
      "Mero Note organizes CSIT study resources such as books, notes, questions, practicals, and past papers. This policy explains how original Mero Note materials, third-party educational materials, and reported concerns are handled.",
    ],
  },
  {
    heading: "Ownership of Mero Note Materials",
    paragraphs: [
      "The Mero Note name, logo, app design, and original descriptions or organization created for the library belong to Mero Note. They may not be copied or presented as another service without permission.",
    ],
  },
  {
    heading: "Third-Party Educational Materials",
    paragraphs: [
      "Many study resources in the library are educational materials created by colleges, publishers, teachers, or other authors. Mero Note does not claim ownership of third-party content. Such materials remain the property of their respective owners and are organized in the library for study and revision purposes.",
    ],
    note: "If you are unsure who owns a particular resource, treat it as third-party content and use it for personal study only.",
  },
  {
    heading: "User-Submitted & Uploaded Content",
    paragraphs: [
      "Where uploads or submissions are supported, you are responsible for what you share. Only share materials you have the right to share, and do not upload content that infringes copyright or violates anyone's rights.",
    ],
  },
  {
    heading: "Copyright Complaints",
    paragraphs: [
      "If you believe content in the Mero Note library infringes your copyright, you may submit a complaint. Please identify the resource clearly so it can be located and reviewed.",
    ],
    bullets: [
      "The title or link of the resource inside Mero Note.",
      "Your relationship to the work (author, publisher, or authorized representative).",
      "A short explanation of the concern and how to contact you.",
    ],
  },
  {
    heading: "Removal & Takedown Requests",
    paragraphs: [
      "Valid concerns are reviewed and the relevant resource may be limited, updated with proper attribution, or removed from the library while the matter is assessed. Repeat or clearly infringing uploads may also lead to account restrictions.",
    ],
  },
  {
    heading: "Unauthorized Redistribution",
    paragraphs: [
      "Library resources are provided for personal study inside and through Mero Note. Please do not re-upload, resell, or broadly redistribute downloaded files or library content without permission from the relevant owner.",
    ],
  },
  {
    heading: "Proper Use of Study Materials",
    paragraphs: [
      "Use books, notes, questions, and past papers for learning, practice, and revision. When quoting or sharing excerpts outside personal study, credit the original source and respect fair, lawful use.",
    ],
  },
  {
    heading: "Contact & Reporting",
    paragraphs: [
      "To report a copyright concern or ask about proper use of study materials, reach out through the official Mero Note Instagram profile linked below with the details of the resource.",
    ],
  },
];

export default function CopyrightPolicy() {
  return (
    <LegalPageLayout
      title="Copyright & Content Policy"
      intro="How Mero Note respects authors and handles study resources in the library."
      updated="September 2026"
      sections={SECTIONS}
    />
  );
}
