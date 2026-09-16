import { Fragment } from "react";

interface CourseMetadataProps {
  code: string;
  credits?: number;
  fullMarks?: number;
  topicCount: number;
  resourceCount: number;
}

/** Compact inline academic metadata — value over label, no dashboard cards. */
export function CourseMetadata({ code, credits, fullMarks, topicCount, resourceCount }: CourseMetadataProps) {
  const codeItem = { value: code as string | number, label: "Course Code" };
  const statItems: { value: string | number; label: string }[] = [
    ...(credits != null ? [{ value: credits, label: "Credit Hours" }] : []),
    ...(fullMarks != null ? [{ value: fullMarks, label: "Full Marks" }] : []),
    { value: topicCount, label: topicCount === 1 ? "Topic" : "Topics" },
    { value: resourceCount, label: resourceCount === 1 ? "Resource" : "Resources" },
  ];

  const renderItem = (
    { value, label }: { value: string | number; label: string },
    valueClass = "font-bold text-foreground",
  ) => (
    <div className="min-w-0">
      <dt className="sr-only">{label}</dt>
      <dd className="flex flex-col">
        <span className={`text-lg leading-tight ${valueClass}`}>{value}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </dd>
    </div>
  );

  return (
    <dl className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
      {renderItem(codeItem, "font-extrabold text-primary")}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {statItems.map(({ value, label }) => (
          <Fragment key={label}>{renderItem({ value, label })}</Fragment>
        ))}
      </div>
    </dl>
  );
}
