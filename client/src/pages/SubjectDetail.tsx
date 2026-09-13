import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { ErrorState } from "../components/common/States";
import { BackButton } from "../components/common/BackButton";
import { SubjectHeader } from "../components/subjects/SubjectHeader";
import { TopicAccordion } from "../components/subjects/TopicAccordion";
import { TopicResourceList } from "../components/subjects/TopicResourceList";
import { TopicResourceSection } from "../components/subjects/TopicResourceSection";
import {
  getSubjectById,
  getSemesterById,
  getTopicsBySubject,
  getResourcesByTopic,
  getResourcesBySubject,
  getSubjectWideResources,
} from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { useCmsSync } from "../components/common/CmsSync";

export default function SubjectDetail() {
  useCmsSync();
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    isFavoriteSubject,
    toggleFavoriteSubject,
    isSubjectBookmarked,
    toggleBookmarkSubject,
  } = useLibrary();

  const subject = getSubjectById(subjectId);
  const semester = subject ? getSemesterById(subject.semesterId) : undefined;

  const [openTopicId, setOpenTopicId] = useState<string | null>(null);

  const topics = useMemo(
    () => (subject ? getTopicsBySubject(subject.id) : []),
    [subject],
  );
  const allResources = useMemo(
    () => (subject ? getResourcesBySubject(subject.id) : []),
    [subject],
  );
  const subjectWideResources = useMemo(
    () => (subject ? getSubjectWideResources(subject.id) : []),
    [subject],
  );

  const topicResources = useMemo(
    () =>
      Object.fromEntries(
        topics.map((t) => [t.id, getResourcesByTopic(t.id)]),
      ) as Record<string, ReturnType<typeof getResourcesByTopic>>,
    [topics],
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

  const favorite = isFavoriteSubject(subject.id);
  const bookmarked = isSubjectBookmarked(subject.id);

  const handleToggleFavorite = () => {
    toggleFavoriteSubject(subject.id);
    toast(favorite ? `Removed ${subject.name} from favorites` : `Added ${subject.name} to favorites`);
  };

  const handleToggleBookmark = () => {
    toggleBookmarkSubject(subject.id);
    toast(bookmarked ? `Removed bookmark for ${subject.name}` : `Bookmarked ${subject.name}`);
  };

  const handleTopicToggle = (topicId: string) => {
    // Accordion behavior: only one topic expanded at a time. Flip to
    // setOpenTopicId((prev) => prev === topicId ? prev : topicId) to allow
    // multiple simultaneously open topics later.
    setOpenTopicId((prev) => (prev === topicId ? null : topicId));
  };

  return (
    <div>
      <div className="mb-1 -ml-1 sm:-ml-1">
        <BackButton label="Back to semester" />
      </div>

      <SubjectHeader
        subject={subject}
        semester={semester}
        topicCount={topics.length}
        resourceCount={allResources.length}
        favorite={favorite}
        bookmarked={bookmarked}
        onToggleFavorite={handleToggleFavorite}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* Subject-wide resources (primary textbook etc.) — no topic required. */}
      {subjectWideResources.length > 0 && (
        <TopicResourceSection
          icon={<BookOpen className="size-4" aria-hidden="true" />}
          title="Subject Resources"
          count={subjectWideResources.length}
        >
          <TopicResourceList resources={subjectWideResources} />
        </TopicResourceSection>
      )}

      {/* Topics */}
      {topics.length === 0 ? (
        <ErrorState
          title="No topics available yet."
          message="Topics for this subject will appear once they are added."
        />
      ) : (
        <TopicResourceSection
          title="Topics"
          icon={<BookOpen className="size-4" aria-hidden="true" />}
          count={topics.length}
        >
          <div className="space-y-3">
            {topics.map((topic) => (
              <TopicAccordion
                key={topic.id}
                topic={topic}
                resourceCount={topicResources[topic.id]?.length ?? 0}
                isOpen={openTopicId === topic.id}
                onToggle={handleTopicToggle}
              >
                <TopicResourceList resources={topicResources[topic.id] ?? []} />
              </TopicAccordion>
            ))}
          </div>
        </TopicResourceSection>
      )}
    </div>
  );
}
