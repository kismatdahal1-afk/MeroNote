import { useNavigate, useParams } from "react-router-dom";
import { SemesterCard } from "../components/cards/SemesterCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { PageHeader } from "../components/common/PageHeader";
import { SearchBar } from "../components/common/SearchBar";
import { getSemesterById, getSubjectsBySemester, getAllSemesters } from "../data/selectors";

export default function Semesters() {
  return (
    <div>
      <PageHeader
        title="Semester Library"
        subtitle="Browse the full CSIT curriculum — semester by semester."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {getAllSemesters().map((sem) => (
          <SemesterCard key={sem.id} semester={sem} />
        ))}
      </div>
    </div>
  );
}

export function SemesterSubjects() {
  const { semesterId } = useParams<{ semesterId: string }>();
  const navigate = useNavigate();
  const semester = getSemesterById(semesterId);

  if (!semester) {
    return (
      <div className="py-16 text-center text-slate-500 dark:text-slate-400">
        Semester not found.{" "}
        <button type="button" onClick={() => navigate("/semesters")} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Back to semesters
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={semester.name}
        subtitle={semester.description}
        breadcrumbs={[
          { label: "Semesters", to: "/semesters" },
          { label: semester.name },
        ]}
      />
      <SearchBar
        className="mb-6 max-w-md"
        placeholder={`Search ${semester.name} subjects...`}
        onSubmit={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {getSubjectsBySemester(semester.id).map((subject) => (
          <SubjectCard key={subject.id} subject={subject} />
        ))}
      </div>
    </div>
  );
}
