import { LegalPageLayout, type LegalSectionData } from "./LegalLayout";

const SECTIONS: LegalSectionData[] = [
  {
    heading: "Educational Purpose",
    paragraphs: [
      "Mero Note is a study support library for BSc CSIT students. Books, notes, questions, practicals, and past papers are organized to help you learn and revise. They are a supplement to your classes, textbooks, and official syllabus — not a replacement.",
    ],
  },
  {
    heading: "Content Accuracy",
    paragraphs: [
      "Study materials are organized from educational sources and may contain errors, omissions, or outdated information. Always verify important topics against your current syllabus, class notes, and trusted textbooks.",
    ],
  },
  {
    heading: "Third-Party Information",
    paragraphs: [
      "Some resources originate from colleges, publishers, teachers, or other third parties. Mero Note does not claim authorship of third-party materials and cannot guarantee the views, completeness, or currency of every resource.",
    ],
  },
  {
    heading: "Exam & Result Disclaimer",
    paragraphs: [
      "Using Mero Note does not guarantee marks, grades, or exam outcomes. Question patterns, important topics, and past papers reflect previous material for practice; your actual exams are set and evaluated by your university and college.",
    ],
  },
  {
    heading: "Availability",
    paragraphs: [
      "The library, reader, downloads, and progress features are provided on a best-effort basis. Resources or features may change or be temporarily unavailable due to maintenance, updates, or connectivity. Keep your own backups of critical personal notes.",
    ],
  },
  {
    heading: "External Links",
    paragraphs: [
      "Mero Note may link to external profiles or resources, such as the official Instagram profile. External content is controlled by its own owners, and Mero Note is not responsible for what those external pages contain or how they change.",
    ],
  },
  {
    heading: "User Responsibility",
    paragraphs: [
      "How you study, which resources you trust, and what you submit in exams or assignments remain your responsibility. Use your judgment alongside guidance from your teachers and official college notices.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "If you spot an error in the library or have questions about this disclaimer, reach out through the official Mero Note Instagram profile linked below.",
    ],
  },
];

export default function Disclaimer() {
  return (
    <LegalPageLayout
      title="Disclaimer"
      intro="What Mero Note is — and is not — responsible for as an educational study library."
      updated="September 2026"
      sections={SECTIONS}
    />
  );
}
