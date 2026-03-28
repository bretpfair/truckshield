import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Pencil, Trash2, UserCog, Clock, CheckCircle2, XCircle } from "lucide-react";

interface StaffMember {
  user_id: string | null;
  role: "admin" | "producer";
  full_name: string | null;
  email: string;
  phone: string | null;
  company_name: string | null;
  status: "pending" | "accepted" | "expired";
  invited_at: string;
}

const roleBadge: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  producer: "bg-accent/10 text-accent-foreground border-accent/20",
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  accepted: { label: "Active", icon: CheckCircle2, color: "text-success" },
  pending: { label: "Pending", icon: Clock, color: "text-warning" },
  expired: { label: "Expired", icon: XCircle, color: "text-muted-foreground" },
};

const StaffManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", company_name: "", role: "" as string });
  const [deleteConfirm, setDeleteConfirm] = useState<StaffMember | null>(null);

  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      // Get all staff invitations
      const { data: invitations, error: invErr } = await supabase
        .from("staff_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (invErr) throw invErr;

      // Get all user_roles for admin and producer
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "producer"]);
      if (rolesErr) throw rolesErr;

      // Get profiles for accepted members
      const acceptedUserIds = (roles || []).map((r) => r.user_id);
      let profiles: any[] = [];
      if (acceptedUserIds.length > 0) {
        const { data: p, error: profErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone, company_name")
          .in("user_id", acceptedUserIds);
        if (profErr) throw profErr;
        profiles = p || [];
      }

      const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
      const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

      // Build list from invitations as the source of truth
      // First pass: group invitations by email, preferring accepted over pending
      const invByEmail = new Map<string, typeof invitations[number]>();
      for (const inv of invitations || []) {
        const email = inv.email.toLowerCase();
        const existing = invByEmail.get(email);
        if (!existing) {
          invByEmail.set(email, inv);
        } else if (inv.status === "accepted" && existing.status !== "accepted") {
          // Prefer accepted invitation
          invByEmail.set(email, inv);
        }
      }

      const members: StaffMember[] = [];
      const seenEmails = new Set<string>();

      for (const inv of invByEmail.values()) {
        const email = inv.email.toLowerCase();
        seenEmails.add(email);

        const isExpired = new Date(inv.expires_at) < new Date() && inv.status === "pending";
        const effectiveStatus = isExpired ? "expired" : inv.status as "pending" | "accepted";

        // For accepted invitations, find the matching user role + profile
        let userId: string | null = null;
        let profile: any = null;
        let currentRole = (inv.invited_role || "producer") as "admin" | "producer";

        if (effectiveStatus === "accepted") {
          const matchedProfile = profiles.find((p) => p.email?.toLowerCase() === email);
          if (matchedProfile) {
            userId = matchedProfile.user_id;
            profile = matchedProfile;
            const liveRole = roleMap.get(userId!);
            if (liveRole) currentRole = liveRole as "admin" | "producer";
          }
        }

        members.push({
          user_id: userId,
          role: currentRole,
          full_name: profile?.full_name ?? null,
          email,
          phone: profile?.phone ?? null,
          company_name: profile?.company_name ?? null,
          status: effectiveStatus,
          invited_at: inv.created_at,
        });
      }

      // Also include any staff with roles who weren't invited through the system (e.g. first admin)
      // Build a map of user_id -> invitation email for accepted invitations (fallback when profile is empty)
      const acceptedInvEmailMap = new Map<string, string>();
      for (const m of members) {
        if (m.user_id && m.status === "accepted") {
          acceptedInvEmailMap.set(m.user_id, m.email);
        }
      }

      for (const r of roles || []) {
        const p = profileMap.get(r.user_id);
        const email = p?.email?.toLowerCase();
        // Check if this user was already added via invitation matching
        if (email && seenEmails.has(email)) continue;
        // Also check if user_id is already in the list from accepted invitations
        const alreadyListed = members.some((m) => m.user_id === r.user_id);
        if (alreadyListed) continue;

        // Try to find an invitation email for this user as a fallback
        const fallbackEmail = acceptedInvEmailMap.get(r.user_id);
        const displayEmail = email || fallbackEmail || r.user_id;
        if (displayEmail && displayEmail !== r.user_id) seenEmails.add(displayEmail);

        members.unshift({
          user_id: r.user_id,
          role: r.role as "admin" | "producer",
          full_name: p?.full_name ?? null,
          email: displayEmail,
          phone: p?.phone ?? null,
          company_name: p?.company_name ?? null,
          status: "accepted",
          invited_at: "",
        });
      }

      return members;
    },
  });

  const openEdit = (member: StaffMember) => {
    setEditingMember(member);
    setEditForm({
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      company_name: member.company_name || "",
      role: member.role,
    });
  };

  const updateMember = useMutation({
    mutationFn: async () => {
      if (!editingMember) throw new Error("No member selected");

      // Only update profile/role for accepted members with a user_id
      if (editingMember.user_id) {
        const uid = editingMember.user_id;
        const { error: profErr } = await supabase
          .from("profiles")
          .update({
            full_name: editForm.full_name || null,
            email: editForm.email || null,
            phone: editForm.phone || null,
            company_name: editForm.company_name || null,
          })
          .eq("user_id", uid);
        if (profErr) throw profErr;

        if (editForm.role !== editingMember.role) {
          const { error: roleErr } = await supabase
            .from("user_roles")
            .update({ role: editForm.role as "admin" | "producer" })
            .eq("user_id", uid);
          if (roleErr) throw roleErr;
        }
      } else {
        // Pending invitation — update the invited_role on the invitation
        if (editForm.role !== editingMember.role) {
          const { error } = await supabase
            .from("staff_invitations")
            .update({ invited_role: editForm.role })
            .eq("email", editingMember.email)
            .eq("status", "pending");
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] });
      queryClient.invalidateQueries({ queryKey: ["staff-invitations"] });
      setEditingMember(null);
      toast({ title: "Staff member updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (member: StaffMember) => {
      if (member.user_id) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", member.user_id);
        if (error) throw error;
      }
      // Also clean up invitation
      const { error: invErr } = await supabase
        .from("staff_invitations")
        .delete()
        .eq("email", member.email);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] });
      queryClient.invalidateQueries({ queryKey: ["staff-invitations"] });
      setDeleteConfirm(null);
      toast({ title: "Staff member removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
          <UserCog className="h-4 w-4 text-primary" /> Staff Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading staff…</p>
        ) : !staffMembers?.length ? (
          <p className="text-sm text-muted-foreground">No staff members found. Invite staff from the Invite Staff tab.</p>
        ) : (
          <div className="space-y-2">
            {staffMembers.map((m, idx) => {
              const isSelf = m.user_id === user?.id;
              const sc = statusConfig[m.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              return (
                <div
                  key={m.email + idx}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {m.full_name || m.email}
                        {isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                      </p>
                      {m.full_name && (
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`flex items-center gap-1 text-xs ${sc.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {sc.label}
                    </div>
                    <Badge variant="outline" className={roleBadge[m.role] || ""}>
                      {m.role === "admin" ? "Admin" : "Producer"}
                    </Badge>
                    {(m.status === "accepted" || m.status === "pending") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(o) => !o && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              {editingMember?.status === "pending"
                ? "This member hasn't accepted their invitation yet. You can change their assigned role."
                : "Update the staff member's profile information and role."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingMember?.status === "accepted" && (
              <>
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input
                    value={editForm.company_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="producer">Producer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
            <Button onClick={() => updateMember.mutate()} disabled={updateMember.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Staff Member</DialogTitle>
            <DialogDescription>
              This will remove{" "}
              <strong>{deleteConfirm?.full_name || deleteConfirm?.email || "this user"}</strong>
              {deleteConfirm?.status === "accepted"
                ? " and revoke their staff access."
                : "'s pending invitation."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && removeMember.mutate(deleteConfirm)}
              disabled={removeMember.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StaffManager;
