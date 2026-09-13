import { useMemo } from "react";
import { useCms } from "../../state/CmsProvider";
import { Select } from "../common/Field";
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
  const db = useCms();

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );
  const subjects: Subject[] = useMemo(
    () =>
      semesterId
        ? db.subjects.filter((s) => !s.deletedAt && s.semesterId === semesterId)
        : [],
    [db.subjects, semesterId],
  );
  const topics: Topic[] = useMemo(
    () =>
      subjectId
        ? db.topics
            .filter((t) => !t.deletedAt && t.subjectId === subjectId)
            .sort((a, b) => a.order - b.order)
        : [],
    [db.topics, subjectId],
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
