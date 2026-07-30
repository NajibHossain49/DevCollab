"use client";

import { Check, Copy } from "lucide-react";
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
import { useInviteMember } from "@/hooks/useOrganization";
import { ApiError } from "@/lib/api";
import type { EmailStatus, InviteResult, OrgRole } from "@/types";

const inviteSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

type AssignableRole = Exclude<OrgRole, "OWNER">;

interface InviteMemberModalProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_STATUS_MESSAGE: Record<EmailStatus, string> = {
  sent: "Invite email sent.",
  queued: "Daily email limit reached — the invite was queued. Share the link below.",
  disabled: "Email delivery is off. Share the invite link below.",
  error: "Couldn't send the email. Share the invite link below.",
};

export function InviteMemberModal({
  slug,
  open,
  onOpenChange,
}: InviteMemberModalProps) {
  const invite = useInviteMember(slug);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("MEMBER");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setRole("MEMBER");
    setErrors({});
    setFormError(null);
    setResult(null);
    setCopied(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      setErrors({ email: parsed.error.flatten().fieldErrors.email?.[0] });
      return;
    }
    setErrors({});

    try {
      const response = await invite.mutateAsync(parsed.data);
      if (response.data?.invite) {
        setResult(response.data.invite);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore silently.
    }
  };

  const pending = invite.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Invite a member">
      <DialogHeader>
        <DialogTitle>Invite a member</DialogTitle>
        <DialogDescription>
          Send an email invite. They&apos;ll join once they accept.
        </DialogDescription>
      </DialogHeader>

      {result ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
            {EMAIL_STATUS_MESSAGE[result.emailStatus]}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label>Invite link</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={result.inviteLink} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy invite link"
                onClick={copyLink}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset}>
              Invite another
            </Button>
            <Button type="button" onClick={() => handleClose(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              autoFocus
              placeholder="teammate@example.com"
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
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
              Send invite
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
