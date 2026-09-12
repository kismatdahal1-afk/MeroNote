import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { EmptyState, ErrorState } from "../components/common/States";
import { FilterChips } from "../components/resources/FilterChips";
import { getSubjectById, getSemesterById, getResourcesBySubject } from "../data/selectors";
import { ALL_RESOURCE_TYPES } from "../lib/resourceType";
import type { ResourceType } from "../types";

export default function SubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const subject = getSubjectById(subjectId);
  const semester = subject ? getSemesterById(subject.semesterId) : undefined;
  const [filter, setFilter] = useState<ResourceType | "all">("all");

  const resources = useMemo(
    () => (subject ? getResourcesBySubject(subject.id) : []),
    [subject],
  );

  const counts = useMemo(() => {
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of resources) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [resources]);

  const filtered = useMemo(
    () => (filter === "all" ? resources : resources.filter((r) => r.type === filter)),
    [resources, filter],
  );

  if (!subject || !semester) {
    return (
      <ErrorState
        title="Subject not found"
        message="The subject you are looking for does not exist or has been removed."
        onRetry={() => navigate("/semesters")}
      />
    );
  }

  const categoriesPresent = ALL_RESOURCE_TYPES.filter((t) => counts[t]);

  return (
    <div>
      <PageHeader
        title={subject.name}
        subtitle={subject.description}
        breadcrumbs={[
          { label: "Semesters", to: "/semesters" },
          { label: semester.name, to: `/semesters/${semester.id}` },
          { label: subject.name },
        ]}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <BookOpen className="size-4" aria-hidden="true" />
            {resources.length} resources
          </span>
        }
      />

      {resources.length === 0 ? (
        <EmptyState
          title="No resources yet"
          message="Resources for this subject will appear once uploaded."
        />
      ) : (
        <>
          <div className="mb-5">
            <FilterChips selected={filter} counts={counts} onChange={setFilter} />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title={`No ${filter !== "all" ? "resources" : ""} in this category`}
              message="Try a different resource type."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <ResourceCard key={r.id} resource={r} showContext={false} />
              ))}
            </div>
          )}
          {categoriesPresent.length === 0 && null}
        </>
      )}
    </div>
  );
}
