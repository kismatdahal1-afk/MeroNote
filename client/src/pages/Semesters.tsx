import { useNavigate, useParams } from "react-router-dom";
import { Play } from "lucide-react";
import { SemesterCard } from "../components/cards/SemesterCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { PageHeader, Card } from "../components/common/PageHeader";
import { ProgressRing } from "../components/common/ProgressRing";
import { Button } from "../components/common/Button";
import { SearchBar } from "../components/common/SearchBar";
import { Badge } from "../components/common/Badge";
import {
  getSemesterById,
  getSubjectsBySemester,
  getAllSemesters,
  getActiveSemester,
} from "../data/selectors";

export default function Semesters() {
  const all = getAllSemesters();
  const active = getActiveSemester();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Semester Library"
        subtitle="Your complete CSIT curriculum — semester by semester."
      />

      {/* Active semester banner with completion ring + launcher */}
      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <ProgressRing
            value={active.completion}
            size={72}
            label={`${active.name} completion`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">Active Enrollment</Badge>
              <span className="text-xs font-bold text-muted-foreground">
                {active.credits} credits this semester
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-foreground">{active.name}</h2>
            <p className="mt-1 line-clamp-1 text-sm font-medium text-muted-foreground">
              {active.description}
            </p>
          </div>
          <Button
            onClick={() => navigate(`/semesters/${active.id}`)}
            className="shrink-0"
            size="lg"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            Continue Studying
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {all.map((sem) => (
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
      <div className="py-16 text-center font-medium text-muted-foreground">
        Semester not found.{" "}
        <button type="button" onClick={() => navigate("/semesters")} className="font-bold text-primary hover:underline">
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
        actions={
          <Badge tone={semester.status === "active" ? "primary" : semester.status === "passed" ? "success" : "neutral"}>
            {semester.status === "active" ? "Active" : semester.status === "passed" ? "Passed" : "Upcoming"}
          </Badge>
        }
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
