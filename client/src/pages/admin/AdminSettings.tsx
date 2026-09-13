import { useMemo, useState, type FormEvent } from "react";
import { Tag, Pencil, Trash2, RotateCcw, Database } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Input } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Badge } from "../../components/common/Badge";
import { EmptyState } from "../../components/common/States";
import { useCms } from "../../state/CmsProvider";
import { getAllTags, renameTag, deleteTag, resetDb } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";

/** Admin Settings: tags management + local CMS data controls. */
export default function AdminSettings() {
  const db = useCms();
  const { toast } = useToast();
  const tags = useMemo(() => getAllTags(), [db.resources]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState(false);

  const handleRename = (e: FormEvent) => {
    e.preventDefault();
    if (renaming && renameValue.trim()) {
      renameTag(renaming, renameValue.trim());
      toast(`Tag renamed to "${renameValue.trim()}"`);
    }
    setRenaming(null);
    setRenameValue("");
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Tags and CMS data controls."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Settings" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tags management */}
        <section aria-labelledby="tags-heading" className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="tags-heading" className="flex items-center gap-2 text-base font-bold text-foreground">
              <Tag className="size-4" aria-hidden="true" /> Tags
            </h2>
            <Badge tone="neutral">{tags.length} in use</Badge>
          </div>
          <Card>
            {tags.length === 0 ? (
              <EmptyState
                title="No tags yet"
                message="Tags are created automatically from resource uploads. Manage them here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {tags.map((tag) => (
                  <li key={tag.name} className="flex items-center gap-3 p-3.5">
                    {renaming === tag.name ? (
                      <form onSubmit={handleRename} className="flex min-w-0 flex-1 items-center gap-2">
                        <Input
                          id={`rename-${tag.name}`}
                          label=""
                          value={renameValue}
                          autoFocus
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="max-w-xs"
                          aria-label={`Rename tag ${tag.name}`}
                        />
                        <Button type="submit" size="sm">Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {tag.name}
                        </span>
                        <Badge tone="primary">{tag.count} uses</Badge>
                        <IconButton
                          icon={Pencil}
                          label={`Rename tag ${tag.name}`}
                          size="sm"
                          onClick={() => {
                            setRenaming(tag.name);
                            setRenameValue(tag.name);
                          }}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Delete tag ${tag.name}`}
                          size="sm"
                          variant="danger"
                          onClick={() => setPendingDeleteTag(tag.name)}
                        />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Data controls */}
        <section aria-labelledby="data-heading">
          <h2 id="data-heading" className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
            <Database className="size-4" aria-hidden="true" /> CMS Data
          </h2>
          <Card className="p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Content is stored in this browser (localStorage) until the real API + database arrive.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Resources</dt>
                <dd className="font-bold text-foreground">{db.resources.filter((r) => !r.deletedAt).length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Notices</dt>
                <dd className="font-bold text-foreground">{db.notices.filter((n) => !n.deletedAt).length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Books</dt>
                <dd className="font-bold text-foreground">{db.books.filter((b) => !b.deletedAt).length}</dd>
              </div>
            </dl>
            <Button variant="danger" className="mt-5 w-full" onClick={() => setPendingReset(true)}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset CMS to seed data
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Restores the original demo content and discards admin changes.
            </p>
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={pendingDeleteTag !== null}
        title="Delete tag"
        message={`Tag "${pendingDeleteTag}" will be removed from every resource using it.`}
        confirmLabel="Delete tag"
        danger
        onCancel={() => setPendingDeleteTag(null)}
        onConfirm={() => {
          if (pendingDeleteTag) {
            deleteTag(pendingDeleteTag);
            toast(`Tag "${pendingDeleteTag}" deleted`);
          }
          setPendingDeleteTag(null);
        }}
      />

      <ConfirmDialog
        open={pendingReset}
        title="Reset CMS data"
        message="All admin changes will be discarded and the original demo content restored."
        confirmLabel="Reset"
        danger
        onCancel={() => setPendingReset(false)}
        onConfirm={() => {
          resetDb();
          toast("CMS data reset to seed content");
          setPendingReset(false);
        }}
      />
    </div>
  );
}
