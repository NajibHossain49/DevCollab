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
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRoom } from "@/hooks/useRooms";
import { ApiError } from "@/lib/api";
import { SUPPORTED_LANGUAGES } from "@/types";

const LANGUAGE_VALUES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "go",
  "rust",
] as const;

const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Room name is required")
    .max(100, "Room name must be 100 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
  language: z.enum(LANGUAGE_VALUES),
  isPublic: z.boolean(),
});

type FieldErrors = Partial<Record<"name" | "description" | "language", string>>;

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_STATE = {
  name: "",
  description: "",
  language: "javascript" as (typeof LANGUAGE_VALUES)[number],
  isPublic: true,
};

export function CreateRoomModal({ open, onOpenChange }: CreateRoomModalProps) {
  const router = useRouter();
  const createRoom = useCreateRoom();

  const [form, setForm] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setForm(INITIAL_STATE);
    setErrors({});
    setFormError(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = createRoomSchema.safeParse({
      name: form.name,
      description: form.description || undefined,
      language: form.language,
      isPublic: form.isPublic,
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
        language: fieldErrors.language?.[0],
      });
      return;
    }

    setErrors({});

    try {
      const response = await createRoom.mutateAsync(parsed.data);
      const room = response.data?.room;
      handleClose(false);
      if (room) {
        router.push(`/room/${room.slug}`);
      }
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  const pending = createRoom.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Create a room">
      <DialogHeader>
        <DialogTitle>Create a room</DialogTitle>
        <DialogDescription>
          Spin up a new collaborative coding session.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-name">Name</Label>
          <Input
            id="room-name"
            value={form.name}
            autoFocus
            placeholder="My awesome room"
            aria-invalid={Boolean(errors.name)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-description">Description</Label>
          <Textarea
            id="room-description"
            value={form.description}
            placeholder="What are you building? (optional)"
            aria-invalid={Boolean(errors.description)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
          {errors.description ? (
            <p className="text-xs text-destructive">{errors.description}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-language">Language</Label>
          <Select
            id="room-language"
            value={form.language}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                language: event.target
                  .value as (typeof LANGUAGE_VALUES)[number],
              }))
            }
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div className="flex flex-col">
            <Label htmlFor="room-public">Public room</Label>
            <span className="text-xs text-muted-foreground">
              Anyone with the link can view this room.
            </span>
          </div>
          <Switch
            id="room-public"
            checked={form.isPublic}
            aria-label="Toggle room visibility"
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, isPublic: checked }))
            }
          />
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
            Create room
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
