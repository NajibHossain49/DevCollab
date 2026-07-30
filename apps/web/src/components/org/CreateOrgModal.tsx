"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useCreateOrg } from "@/hooks/useOrganization";
import { ApiError } from "@/lib/api";

const createOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(100, "Name must be 100 characters or fewer"),
});

interface CreateOrgModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrgModal({ open, onOpenChange }: CreateOrgModalProps) {
  const router = useRouter();
  const createOrg = useCreateOrg();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setError(null);
    setFormError(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = createOrgSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid name");
      return;
    }
    setError(null);

    try {
      const response = await createOrg.mutateAsync(parsed.data);
      const org = response.data?.organization;
      handleClose(false);
      if (org) {
        router.push(`/orgs/${org.slug}`);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  const pending = createOrg.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Create an organization">
      <DialogHeader>
        <DialogTitle>Create an organization</DialogTitle>
        <DialogDescription>
          Create a team to collaborate on rooms with shared members.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            value={name}
            autoFocus
            placeholder="Acme Inc."
            aria-invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        {formError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner className="text-primary-foreground" /> : null}
            Create organization
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
