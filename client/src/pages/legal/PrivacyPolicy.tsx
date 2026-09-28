import { Link } from "react-router-dom";
import { INSTAGRAM_URL } from "../../lib/site";
import { LegalPageLayout, type LegalSectionData } from "./LegalLayout";

const SECTIONS: LegalSectionData[] = [
  {
    heading: "Introduction",
    paragraphs: [
      "Mero Note is a study library for BSc CSIT students, organizing semesters, subjects, topics, and study resources in one place. This Privacy Policy explains what information the app uses to run your study library and how it is handled.",
    ],
  },
  {
    heading: "Information We Collect",
    paragraphs: [
      "Mero Note only handles information needed to operate your account and study library. This includes account details you provide when registering or logging in, and study activity generated as you use the app.",
    ],
    bullets: [
      "Account details such as your name and login credentials.",
      "Study activity such as opened resources, bookmarks, reading progress, and saved lists.",
      "Basic technical information required to keep you signed in and serve content reliably.",
    ],
  },
  {
    heading: "How We Use Information",
    paragraphs: [
      "Information is used to provide the study library, keep your place across devices, and maintain the reliability of the service. It is not used for advertising or sold to third parties.",
    ],
  },
  {
    heading: "Authentication & Account Data",
    paragraphs: [
      "Login sessions are used to identify your account and protect study routes behind the existing authentication gate. Guests visiting the public landing page are not required to create an account.",
    ],
  },
  {
    heading: "Study & Personalization Data",
    paragraphs: [
      "Bookmarks, reading progress, saved resources, and recently opened files are stored so you can resume studying where you left off. This data reflects your own study activity inside Mero Note.",
    ],
  },
  {
    heading: "Downloads & Device Storage",
    paragraphs: [
      "Resources you choose to download are stored on your own device so they remain available when you are offline. You can remove downloaded files from your device storage at any time.",
    ],
  },
  {
    heading: "Cookies & Local Storage",
    paragraphs: [
      "Mero Note uses browser storage such as cookies and local storage for essential functions like keeping you signed in, remembering your theme preference, and supporting offline access. No advertising trackers are used for these purposes.",
    ],
  },
  {
    heading: "Data Sharing",
    paragraphs: [
      "Mero Note does not sell your personal information. Limited technical processing may occur through the hosting and infrastructure required to run the service, only as needed to deliver the app.",
    ],
  },
  {
    heading: "Data Security",
    paragraphs: [
      "Reasonable technical measures are used to protect account access and study data. No online service can guarantee absolute security, so please keep your login credentials private and sign out on shared devices.",
    ],
  },
  {
    heading: "Data Retention",
    paragraphs: [
      "Account and study data is kept while your account is active so your library, bookmarks, and progress remain available. If you stop using Mero Note, you may request removal of your account data subject to operational and legal requirements.",
    ],
  },
  {
    heading: "User Rights",
    paragraphs: [
      "You may review and update your account information from within the app settings where available. For access, correction, or deletion requests, contact Mero Note through the channel below.",
    ],
  },
  {
    heading: "Policy Changes",
    paragraphs: [
      "If this policy changes, the updated version will be published on this page with a revised date. Continued use of Mero Note after changes take effect means you accept the updated policy.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "For privacy questions or requests related to your account data, reach out through the official Mero Note Instagram profile linked below.",
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="How Mero Note handles your account and study activity while you use the CSIT study library."
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
