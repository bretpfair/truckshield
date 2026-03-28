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
import { Users, Pencil, Trash2, ShieldCheck, UserCog } from "lucide-react";

interface StaffMember {
  user_id: string;
  role: "admin" | "producer";
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

const roleBadge: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  producer: "bg-accent/10 text-accent-foreground border-accent/20",
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
      // Get all user_roles for admin and producer
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "producer"]);
      if (rolesErr) throw rolesErr;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, company_name")
        .in("user_id", userIds);
      if (profErr) throw profErr;

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return roles.map((r) => {
        const p = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          role: r.role as "admin" | "producer",
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
          company_name: p?.company_name ?? null,
        };
      }) as StaffMember[];
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
      const uid = editingMember.user_id;

      // Update profile
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

      // Update role if changed
      if (editForm.role !== editingMember.role) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .update({ role: editForm.role as "admin" | "producer" })
          .eq("user_id", uid);
        if (roleErr) throw roleErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] });
      setEditingMember(null);
      toast({ title: "Staff member updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] });
      setDeleteConfirm(null);
      toast({ title: "Staff role removed" });
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
          <p className="text-sm text-muted-foreground">No staff members found.</p>
        ) : (
          <div className="space-y-2">
            {staffMembers.map((m) => {
              const isSelf = m.user_id === user?.id;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {m.full_name || m.email || "Unknown"}
                        {isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                      </p>
                      {m.email && (
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={roleBadge[m.role] || ""}>
                      {m.role === "admin" ? "Admin" : "Producer"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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
              Update the staff member's profile information and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              This will remove the staff role from{" "}
              <strong>{deleteConfirm?.full_name || deleteConfirm?.email || "this user"}</strong>.
              They will no longer have staff access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && removeMember.mutate(deleteConfirm.user_id)}
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
