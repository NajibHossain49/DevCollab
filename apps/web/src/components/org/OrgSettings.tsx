"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateOrg } from "@/hooks/useOrganization";
import { ApiError } from "@/lib/api";
import type { Organization } from "@/types";

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Lowercase letters, numbers, and hyphens only",
    ),
});

type FieldErrors = Partial<Record<"name" | "slug", string>>;

interface OrgSettingsProps {
  organization: Organization;
  /** Only owners/admins can edit; others see read-only fields. */
  canEdit: boolean;
}

export function OrgSettings({ organization, canEdit }: OrgSettingsProps) {
  const router = useRouter();
  const updateOrg = useUpdateOrg(organization.slug);

  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const parsed = settingsSchema.safeParse({ name, slug });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({ name: fieldErrors.name?.[0], slug: fieldErrors.slug?.[0] });
      return;
    }
    setErrors({});

    try {
      const response = await updateOrg.mutateAsync(parsed.data);
      const updated = response.data?.organization;
      setSuccess(true);
      // If the slug changed, the current URL is stale — navigate to the new one.
      if (updated && updated.slug !== organization.slug) {
        router.replace(`/orgs/${updated.slug}`);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to save changes",
      );
    }
  };

  const pending = updateOrg.isPending;
  const dirty = name !== organization.name || slug !== organization.slug;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-name">Organization name</Label>
        <Input
          id="settings-name"
          value={name}
          disabled={!canEdit || pending}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-slug">Slug</Label>
        <Input
          id="settings-slug"
          value={slug}
          disabled={!canEdit || pending}
          aria-invalid={Boolean(errors.slug)}
          onChange={(event) => setSlug(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used in the URL: /orgs/{slug || "your-slug"}
        </p>
        {errors.slug ? (
          <p className="text-xs text-destructive">{errors.slug}</p>
        ) : null}
      </div>

      {formError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
          Changes saved.
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? <Spinner className="text-primary-foreground" /> : null}
            Save changes
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only owners and admins can edit organization settings.
        </p>
      )}
    </form>
  );
}
