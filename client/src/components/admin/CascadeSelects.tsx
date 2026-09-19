import { useMemo } from "react";
import { Select } from "../common/Field";
import { fetchSemesters, fetchSubjects, fetchTopics } from "../../lib/contentApi";
import { useApiQuery } from "../../hooks/useApiQuery";
import type { Subject, Topic } from "../../types";

/**
 * Cascading selects: Semester → Subject → Topic.
 * Changing a parent resets invalid child selections via the on*Change props.
 */

interface CascadeSelectsProps {
  semesterId: string;
  subjectId: string;
  topicId?: string;
  onSemesterChange: (id: string) => void;
  onSubjectChange: (id: string) => void;
  onTopicChange?: (id: string) => void;
  /** Allow empty topic selection (resources may skip a topic). */
  topicOptional?: boolean;
  showErrors?: { semesterId?: string; subjectId?: string };
  disabled?: boolean;
}

export function CascadeSelects({
  semesterId,
  subjectId,
  topicId = "",
  onSemesterChange,
  onSubjectChange,
  onTopicChange,
  topicOptional = false,
  showErrors,
  disabled = false,
}: CascadeSelectsProps) {
  // Admin taxonomy for selects. Failures degrade to empty option lists —
  // the parent form surfaces its own validation errors on submit.
  const { data: semestersData } = useApiQuery("admin-taxonomy-semesters", () => fetchSemesters());
  const { data: subjectsData } = useApiQuery(`admin-taxonomy-subjects-${semesterId}`, (signal) =>
    semesterId ? fetchSubjects(semesterId, signal) : Promise.resolve({ rows: [], total: 0 }),
  );
  const { data: topicsData } = useApiQuery(`admin-taxonomy-topics-${subjectId}`, (signal) =>
    subjectId ? fetchTopics(subjectId, signal) : Promise.resolve({ rows: [], total: 0 }),
  );

  const semesters = useMemo(
    () => [...(semestersData?.rows ?? [])].sort((a, b) => a.order - b.order),
    [semestersData],
  );
  const subjects: Subject[] = useMemo(() => subjectsData?.rows ?? [], [subjectsData]);
  const topics: Topic[] = useMemo(
    () => [...(topicsData?.rows ?? [])].sort((a, b) => a.order - b.order),
    [topicsData],
  );

  return (
    <>
      <Select
        id="cascade-semester"
        label="Semester"
        value={semesterId}
        disabled={disabled}
        error={showErrors?.semesterId}
        onChange={(e) => onSemesterChange(e.target.value)}
        options={[
          { value: "", label: "Select semester..." },
          ...semesters.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <Select
        id="cascade-subject"
        label="Subject"
        value={subjectId}
        disabled={disabled || !semesterId}
        error={showErrors?.subjectId}
        onChange={(e) => onSubjectChange(e.target.value)}
        options={[
          {
            value: "",
            label: semesterId ? "Select subject..." : "Choose a semester first",
          },
          ...subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
        ]}
      />
      {onTopicChange && (
        <Select
          id="cascade-topic"
          label={topicOptional ? "Topic (optional)" : "Topic"}
          value={topicId}
          disabled={disabled || !subjectId}
          onChange={(e) => onTopicChange(e.target.value)}
          options={[
            { value: "", label: subjectId ? (topicOptional ? "No specific topic" : "Select topic...") : "Choose a subject first" },
            ...topics.map((t) => ({ value: t.id, label: t.title })),
          ]}
        />
      )}
    </>
  );
}
