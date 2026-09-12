import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { EmptyState } from "../components/common/States";
import { getResourceById } from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";

export default function Favorites() {
  const { favorites } = useLibrary();

  const resources = favorites
    .map((id) => getResourceById(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div>
      <PageHeader
        title="Favorites"
        subtitle="Resources you've marked for quick access."
      />
      {resources.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          message="Tap the heart icon on any resource and it will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}
