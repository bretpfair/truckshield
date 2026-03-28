import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen, Upload, FileText, Image, File, Download, Trash2, Filter,
} from "lucide-react";
import { format } from "date-fns";

const categories = [
  { value: "all", label: "All Documents" },
  { value: "application", label: "Applications" },
  { value: "loss_runs", label: "Loss Runs" },
  { value: "cab_cards", label: "Cab Cards" },
  { value: "mvr", label: "MVR" },
  { value: "drivers_license", label: "Drivers License" },
  { value: "quotes", label: "Quotes" },
  { value: "policies", label: "Policies" },
  { value: "misc", label: "Miscellaneous" },
];

const categoryColors: Record<string, string> = {
  application: "bg-primary/10 text-primary border-primary/20",
  loss_runs: "bg-warning/10 text-warning border-warning/20",
  cab_cards: "bg-accent/10 text-accent border-accent/20",
  mvr: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  drivers_license: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  quotes: "bg-success/10 text-success border-success/20",
  policies: "bg-success/20 text-success border-success/30",
  misc: "bg-muted text-muted-foreground border-border",
};

const fileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return Image;
  if (["pdf", "doc", "docx"].includes(ext || "")) return FileText;
  return File;
};

interface Props {
  accountId: string;
  readOnly?: boolean;
}

const DocumentHub = ({ accountId, readOnly = false }: Props) => {
  const [category, setCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents } = useQuery({
    queryKey: ["account_documents", accountId, category],
    queryFn: async () => {
      let query = supabase
        .from("account_documents")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (category !== "all") {
        query = query.eq("category", category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getBucket = (doc: { category?: string }) =>
    doc.category === "cab_cards" ? "cab-cards" : "account-documents";

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; file_path: string; category?: string }) => {
      await supabase.storage.from(getBucket(doc)).remove([doc.file_path]);
      const { error } = await supabase.from("account_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account_documents", accountId] });
      toast({ title: "Document deleted" });
    },
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!uploadCategory) {
      toast({ title: "Select a document type", description: "Please choose a category before uploading", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${accountId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("account-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("account_documents").insert({
          account_id: accountId,
          uploaded_by: user!.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          category: uploadCategory,
        });
        if (dbError) throw dbError;

        // Log activity
        await supabase.from("activity_log").insert({
          account_id: accountId,
          user_id: user!.id,
          action_type: "document_uploaded",
          description: `Uploaded document: ${file.name} (${categories.find(c => c.value === uploadCategory)?.label})`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["account_documents", accountId] });
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });
      toast({ title: "Document(s) uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string, docCategory?: string) => {
    const bucket = docCategory === "cab_cards" ? "cab-cards" : "account-documents";
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" /> Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload + Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!readOnly && (
            <>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className={`w-[160px] h-8 text-xs ${!uploadCategory ? "border-destructive/50" : ""}`}>
                  <SelectValue placeholder="Select type *" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.value !== "all").map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className={!uploadCategory ? "pointer-events-none opacity-50" : "cursor-pointer"}>
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" asChild disabled={uploading || !uploadCategory}>
                  <span>
                    <Upload className="h-3 w-3" /> {uploading ? "Uploading..." : "Upload"}
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>
            </>
          )}

          <Badge variant="outline" className="text-[10px] h-6 ml-auto">
            {documents?.length ?? 0} files
          </Badge>
        </div>

        {/* Document List */}
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {documents?.map((doc) => {
              const Icon = fileIcon(doc.file_name);
              const catColor = categoryColors[doc.category] || categoryColors.misc;
              return (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                      <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                      {doc.file_size && <span>{formatSize(doc.file_size)}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] h-5 ${catColor}`}>
                    {categories.find(c => c.value === doc.category)?.label || doc.category}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(doc.file_path, doc.file_name, doc.category)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: doc.id, file_path: doc.file_path, category: doc.category })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {(!documents || documents.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-6">No documents uploaded yet</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DocumentHub;
