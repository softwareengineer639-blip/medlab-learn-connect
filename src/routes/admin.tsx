import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck, Microscope, LogOut, Plus, Pencil, Trash2, Users, BookOpen, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils-date";

export const Route = createFileRoute("/admin")({ component: Admin });

type AdminNote = { id: string; title: string; topic: string | null; content: string; created_at: string; updated_at: string };
type Student = {
  id: string; full_name: string; matric_number: string; email: string;
  created_at: string; last_seen_at: string;
  reactions: number; comments: number; discussions: number;
};

function Admin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(null); return; }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  if (loading || (user && isAdmin === null)) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) return <NotSignedIn />;
  if (!isAdmin) return <NotAuthorized />;
  return <AdminDashboard />;
}

function AuthShellLite({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background bg-lab-grid">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Microscope className="h-5 w-5" />
          </div>
          <div className="font-display text-lg font-semibold">Lecture Hub</div>
        </Link>
        <Card className="w-full p-7">{children}</Card>
      </div>
    </div>
  );
}

function NotSignedIn() {
  return (
    <AuthShellLite>
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-semibold">Lecturer access</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Sign in with your lecturer account to manage notes and view engagement.
      </p>
      <div className="mt-5 flex gap-2">
        <Button asChild className="flex-1"><Link to="/login">Sign in</Link></Button>
        <Button asChild variant="outline" className="flex-1"><Link to="/">Back to Hub</Link></Button>
      </div>
    </AuthShellLite>
  );
}

function NotAuthorized() {
  const { signOut } = useAuth();
  return (
    <AuthShellLite>
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-destructive" />
        <h1 className="font-display text-xl font-semibold">Not authorized</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Your account doesn't have lecturer privileges. If this is a mistake, contact the administrator.
      </p>
      <div className="mt-5 flex gap-2">
        <Button asChild variant="outline" className="flex-1"><Link to="/portal">Student portal</Link></Button>
        <Button className="flex-1" onClick={() => signOut()}>Sign out</Button>
      </div>
    </AuthShellLite>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [totals, setTotals] = useState({ students: 0, reactions: 0, comments: 0, discussionMessages: 0 });

  const [editor, setEditor] = useState<AdminNote | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      const [notesRes, profilesRes, reactionsRes, commentsRes, msgsRes] = await Promise.all([
        supabase.from("notes").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, matric_number, email, created_at, last_seen_at").order("created_at", { ascending: false }),
        supabase.from("reactions").select("user_id"),
        supabase.from("comments").select("user_id"),
        supabase.from("discussion_messages").select("user_id"),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const count = (rows: { user_id: string }[] | null, id: string) =>
        (rows ?? []).filter((r) => r.user_id === id).length;

      const enriched = (profilesRes.data ?? []).map((p) => ({
        ...p,
        reactions: count(reactionsRes.data, p.id),
        comments: count(commentsRes.data, p.id),
        discussions: count(msgsRes.data, p.id),
      })) as Student[];

      setNotes((notesRes.data ?? []) as AdminNote[]);
      setStudents(enriched);
      setTotals({
        students: enriched.length,
        reactions: reactionsRes.data?.length ?? 0,
        comments: commentsRes.data?.length ?? 0,
        discussionMessages: msgsRes.data?.length ?? 0,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load");
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  function openNew() {
    setEditor({ id: "", title: "", topic: "", content: "", created_at: "", updated_at: "" });
    setOpen(true);
  }
  function openEdit(n: AdminNote) { setEditor({ ...n }); setOpen(true); }

  async function save() {
    if (!editor) return;
    if (!editor.title.trim() || !editor.content.trim()) {
      toast.error("Title and content are required"); return;
    }
    try {
      if (editor.id) {
        const { error } = await supabase.from("notes").update({
          title: editor.title,
          topic: editor.topic,
          content: editor.content,
          updated_at: new Date().toISOString(),
        }).eq("id", editor.id);
        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { error } = await supabase.from("notes").insert({
          title: editor.title,
          topic: editor.topic,
          content: editor.content,
        });
        if (error) throw error;
        toast.success("Note posted");
      }
      setOpen(false);
      setEditor(null);
      refresh();
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this note? Reactions and comments will also be removed.")) return;
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      refresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Microscope className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display font-semibold leading-none">Lecturer Dashboard</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Mr. Fidelis's Lecture Hub</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/portal" })}>Student view</Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}><LogOut className="mr-1.5 h-4 w-4" />Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <Stat icon={<Users className="h-4 w-4" />} label="Students" value={totals.students} />
          <Stat icon={<BookOpen className="h-4 w-4" />} label="Notes" value={notes.length} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Reactions" value={totals.reactions} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Comments + msgs" value={totals.comments + totals.discussionMessages} />
        </div>

        <Tabs defaultValue="notes">
          <TabsList className="mb-5">
            <TabsTrigger value="notes"><BookOpen className="mr-1.5 h-4 w-4" />Notes</TabsTrigger>
            <TabsTrigger value="students"><Users className="mr-1.5 h-4 w-4" />Students</TabsTrigger>
          </TabsList>

          <TabsContent value="notes">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Lecture notes</h2>
              <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />New note</Button>
            </div>
            <div className="space-y-3">
              {notes.length === 0 && (
                <Card className="p-10 text-center text-sm text-muted-foreground">No notes yet.</Card>
              )}
              {notes.map((n) => (
                <Card key={n.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {n.topic && <Badge variant="outline" className="mb-2">{n.topic}</Badge>}
                      <div className="font-display text-lg font-semibold">{n.title}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Posted {formatDistanceToNow(n.created_at)} ago
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="students">
            <h2 className="mb-4 font-display text-lg font-semibold">Registered students</h2>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Matric no.</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Reactions</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Discussions</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No students yet.
                    </TableCell></TableRow>
                  )}
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{s.matric_number}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email}</TableCell>
                      <TableCell className="text-right">{s.reactions}</TableCell>
                      <TableCell className="text-right">{s.comments}</TableCell>
                      <TableCell className="text-right">{s.discussions}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(s.created_at)} ago
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Edit note" : "New lecture note"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Topic (optional)</Label>
                <Input value={editor.topic ?? ""} onChange={(e) => setEditor({ ...editor, topic: e.target.value })}
                  placeholder="e.g. Hematology · Microbiology" />
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea rows={12} value={editor.content}
                  onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                  placeholder="Write the lecture note. Plain text is fine; line breaks are preserved." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editor?.id ? "Save changes" : "Post note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}<span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
    </Card>
  );
}
