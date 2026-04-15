import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Plus, AlertTriangle, Pencil, Trash2, X, Check } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

interface Props {
  accountId: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-muted/50 text-muted-foreground border-muted-foreground/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const TaskManager = ({ accountId }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks } = useQuery({
    queryKey: ["tasks", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("account_id", accountId)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        account_id: accountId,
        title,
        description: description || null,
        due_date: dueDate || null,
        priority,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", accountId] });
      setShowForm(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      toast({ title: "Task created" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editTitle,
          description: editDescription || null,
          due_date: editDueDate || null,
          priority: editPriority,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", accountId] });
      setEditingId(null);
      toast({ title: "Task updated" });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", accountId] });
      toast({ title: "Task deleted" });
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "completed" ? "open" : "completed";
      const { error } = await supabase
        .from("tasks")
        .update({
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", accountId] });
    },
  });

  const startEditing = (task: any) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditDueDate(task.due_date || "");
    setEditPriority(task.priority);
  };

  const openTasks = tasks?.filter((t) => t.status !== "completed") || [];
  const completedTasks = tasks?.filter((t) => t.status === "completed") || [];
  const overdueTasks = openTasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));

  const getDueDateLabel = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isPast(d)) return `Overdue (${format(d, "MMM d")})`;
    return format(d, "MMM d, yyyy");
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Tasks & Follow-ups
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {overdueTasks.length} overdue
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="border border-border rounded-md p-3 space-y-3 bg-secondary/30">
            <Input placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="flex-1" />
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createTask.mutate()} disabled={!title.trim()}>Create Task</Button>
            </div>
          </div>
        )}

        {openTasks.length === 0 && completedTasks.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
        )}

        {openTasks.map((task) =>
          editingId === task.id ? (
            <div key={task.id} className="border border-primary/30 rounded-md p-3 space-y-3 bg-secondary/30">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="Description (optional)" />
              <div className="flex gap-2">
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="flex-1" />
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-between">
                <Button variant="destructive" size="sm" className="gap-1" onClick={() => { if (confirm("Delete this task?")) deleteTask.mutate(task.id); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="gap-1">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={() => updateTask.mutate(task.id)} disabled={!editTitle.trim()} className="gap-1">
                    <Check className="h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-2.5 rounded-md border transition-colors group ${
                task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-card"
              }`}
            >
              <Checkbox
                checked={false}
                onCheckedChange={() => toggleTask.mutate({ id: task.id, currentStatus: task.status })}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <Badge variant="outline" className={`text-[10px] h-4 px-1 ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </Badge>
                  <button
                    onClick={() => startEditing(task)}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="Edit task"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                )}
                {task.due_date && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${
                    isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                      ? "text-destructive font-medium"
                      : isToday(new Date(task.due_date))
                      ? "text-warning font-medium"
                      : "text-muted-foreground"
                  }`}>
                    {isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    Due: {getDueDateLabel(task.due_date)}
                  </p>
                )}
                {!task.due_date && (
                  <p className="text-xs text-muted-foreground/50 mt-1">No due date</p>
                )}
              </div>
            </div>
          )
        )}

        {completedTasks.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-mono mb-2">Completed ({completedTasks.length})</p>
            {completedTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-2 opacity-50">
                <Checkbox
                  checked={true}
                  onCheckedChange={() => toggleTask.mutate({ id: task.id, currentStatus: task.status })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through truncate">{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">Due: {format(new Date(task.due_date), "MMM d, yyyy")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskManager;
