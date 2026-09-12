import { useMemo, useState } from "react";
import { SubjectCard } from "../components/cards/SubjectCard";
import { Select } from "../components/common/Field";
import { EmptyState } from "../components/common/States";
import { getAllSemesters, getSubjectsBySemester, getAllResources, countResourcesBySubject } from "../data/selectors";
import { subjects as allSubjects } from "../data/mock";

type SortKey = "name" | "resources" | "code";

export default function Subjects() {
  const semesters = getAllSemesters();
  const [semesterId, setSemesterId] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const visible = useMemo(() => {
    const list = semesterId
      ? getSubjectsBySemester(semesterId)
      : allSubjects;
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "code") sorted.sort((a, b) => a.code.localeCompare(b.code));
    if (sort === "resources")
      sorted.sort((a, b) => countResourcesBySubject(b.id) - countResourcesBySubject(a.id));
    return sorted;
  }, [semesterId, sort]);

  const totalResources = getAllResources().length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Subjects</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          All {allSubjects.length} subjects across {semesters.length} semesters — {totalResources} resources.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Select
          id="subjects-semester"
          label=""
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value)}
          className="sm:w-56"
          aria-label="Filter by semester"
          options={[
            { value: "", label: "All semesters" },
            ...semesters.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <Select
          id="subjects-sort"
          label=""
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="sm:w-48"
          aria-label="Sort subjects"
          options={[
            { value: "name", label: "Sort by name" },
            { value: "code", label: "Sort by code" },
            { value: "resources", label: "Sort by resource count" },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No subjects"
          message="No subjects match this filter."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <SubjectCard key={s.id} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}
