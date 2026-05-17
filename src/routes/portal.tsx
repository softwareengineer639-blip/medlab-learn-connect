import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Microscope, LogOut, BookOpen, MessagesSquare, Send, Trash2, Plus,
  ThumbsUp, Heart, Lightbulb, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils-date";

export const Route = createFileRoute("/portal")({ component: Portal });

type Note = { id: string; title: string; topic: string | null; content: string; created_at: string };
type Reaction = { id: string; note_id: string; user_id: string; type: string };
type Comment = { id: string; note_id: string; user_id: string; content: string; created_at: string; parent_id: string | null };
type Profile = { id: string; full_name: string; matric_number: string };
type Topic = { id: string; title: string; description: string | null; created_by: string | null; created_at: string };
type DMsg = { id: string; topic_id: string; user_id: string; content: string; created_at: string };

const REACTIONS = [
  { type: "like", label: "Like", icon: ThumbsUp },
  { type: "love", label: "Love", icon: Heart },
  { type: "think", label: "Thinking", icon: Lightbulb },
  { type: "insight", label: "Insight", icon: Sparkles },
] as const;

function Portal() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Microscope className="h-4 w-4" />
            </div>
            <div className="font-display font-semibold">Lecture Hub</div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{profile?.full_name || "Student"}</div>
              <div className="text-xs text-muted-foreground">{profile?.matric_number}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Tabs defaultValue="notes">
          <TabsList className="mb-6">
            <TabsTrigger value="notes"><BookOpen className="mr-1.5 h-4 w-4" />Lecture notes</TabsTrigger>
            <TabsTrigger value="discuss"><MessagesSquare className="mr-1.5 h-4 w-4" />Discussions</TabsTrigger>
          </TabsList>
          <TabsContent value="notes"><NotesFeed userId={user.id} /></TabsContent>
          <TabsContent value="discuss"><Discussions userId={user.id} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NotesFeed({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [n, r, c, p] = await Promise.all([
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("reactions").select("*"),
      supabase.from("comments").select("*").order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, matric_number"),
    ]);
    setNotes((n.data as Note[]) ?? []);
    setReactions((r.data as Reaction[]) ?? []);
    setComments((c.data as Comment[]) ?? []);
    const map: Record<string, Profile> = {};
    (p.data ?? []).forEach((x: Profile) => (map[x.id] = x));
    setProfiles(map);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading notes…</p>;
  if (notes.length === 0) return (
    <Card className="p-10 text-center text-muted-foreground">
      <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
      No notes yet. Check back soon — Mr. Fidelis will post lecture material here.
    </Card>
  );

  return (
    <div className="space-y-6">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          userId={userId}
          reactions={reactions.filter((r) => r.note_id === note.id)}
          comments={comments.filter((c) => c.note_id === note.id)}
          profiles={profiles}
          onChange={refresh}
        />
      ))}
    </div>
  );
}

function NoteCard({
  note, userId, reactions, comments, profiles, onChange,
}: {
  note: Note; userId: string; reactions: Reaction[]; comments: Comment[];
  profiles: Record<string, Profile>; onChange: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  async function toggleReaction(type: string) {
    const existing = reactions.find((r) => r.user_id === userId && r.type === type);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      const { error } = await supabase.from("reactions").insert({ note_id: note.id, user_id: userId, type });
      if (error) toast.error(error.message);
    }
    onChange();
  }

  async function addComment() {
    const text = commentText.trim();
    if (!text) return;
    if (text.length > 2000) { toast.error("Comment too long"); return; }
    const { error } = await supabase.from("comments").insert({ note_id: note.id, user_id: userId, content: text });
    if (error) { toast.error(error.message); return; }
    setCommentText("");
    onChange();
  }

  async function deleteComment(id: string) {
    await supabase.from("comments").delete().eq("id", id);
    onChange();
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 bg-secondary/40 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            {note.topic && (
              <Badge variant="outline" className="mb-2 border-primary/30 bg-accent text-accent-foreground">
                {note.topic}
              </Badge>
            )}
            <h2 className="font-display text-xl font-semibold leading-tight">{note.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Posted {formatDistanceToNow(note.created_at)} ago
            </p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{note.content}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3">
        {REACTIONS.map((r) => {
          const count = reactions.filter((x) => x.type === r.type).length;
          const active = reactions.some((x) => x.type === r.type && x.user_id === userId);
          const Icon = r.icon;
          return (
            <Button
              key={r.type}
              variant={active ? "default" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => toggleReaction(r.type)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              <span className="text-xs">{r.label}</span>
              {count > 0 && <span className="ml-1.5 text-xs opacity-80">{count}</span>}
            </Button>
          );
        })}
        <Button
          variant="ghost" size="sm" className="ml-auto h-8"
          onClick={() => setShowComments((s) => !s)}
        >
          <MessagesSquare className="mr-1.5 h-3.5 w-3.5" />
          <span className="text-xs">{comments.length} comment{comments.length === 1 ? "" : "s"}</span>
        </Button>
      </div>

      {showComments && (
        <div className="space-y-3 border-t border-border/60 bg-muted/30 px-6 py-4">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet. Start the conversation.</p>
          )}
          {comments.map((c) => {
            const author = profiles[c.user_id];
            return (
              <div key={c.id} className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium">
                      {author?.full_name || "Student"}{" "}
                      <span className="text-muted-foreground">· {author?.matric_number}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(c.created_at)} ago
                    </p>
                  </div>
                  {c.user_id === userId && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteComment(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="min-h-0 resize-none"
            />
            <Button onClick={addComment} size="sm" className="self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Discussions({ userId }: { userId: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [messages, setMessages] = useState<DMsg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ title: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [msgText, setMsgText] = useState("");

  async function refresh() {
    const [t, m, p] = await Promise.all([
      supabase.from("discussion_topics").select("*").order("created_at", { ascending: false }),
      supabase.from("discussion_messages").select("*").order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, matric_number"),
    ]);
    setTopics((t.data as Topic[]) ?? []);
    setMessages((m.data as DMsg[]) ?? []);
    const map: Record<string, Profile> = {};
    (p.data ?? []).forEach((x: Profile) => (map[x.id] = x));
    setProfiles(map);
  }
  useEffect(() => { refresh(); }, []);

  async function createTopic() {
    const title = newTopic.title.trim();
    if (title.length < 3) { toast.error("Title too short"); return; }
    const { data, error } = await supabase
      .from("discussion_topics")
      .insert({ title, description: newTopic.description.trim() || null, created_by: userId })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setNewTopic({ title: "", description: "" });
    setCreating(false);
    await refresh();
    setActiveId(data.id);
  }

  async function sendMsg() {
    if (!activeId || !msgText.trim()) return;
    const { error } = await supabase
      .from("discussion_messages")
      .insert({ topic_id: activeId, user_id: userId, content: msgText.trim() });
    if (error) { toast.error(error.message); return; }
    setMsgText("");
    refresh();
  }

  const activeTopic = topics.find((t) => t.id === activeId);
  const activeMessages = messages.filter((m) => m.topic_id === activeId);

  if (activeTopic) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => setActiveId(null)}>
          ← All topics
        </Button>
        <Card className="overflow-hidden">
          <div className="border-b border-border/60 bg-secondary/40 px-6 py-4">
            <h2 className="font-display text-xl font-semibold">{activeTopic.title}</h2>
            {activeTopic.description && (
              <p className="mt-1 text-sm text-muted-foreground">{activeTopic.description}</p>
            )}
          </div>
          <div className="space-y-3 bg-muted/30 px-6 py-5">
            {activeMessages.length === 0 && (
              <p className="text-sm text-muted-foreground">No messages yet. Be the first.</p>
            )}
            {activeMessages.map((m) => {
              const author = profiles[m.user_id];
              return (
                <div key={m.id} className="rounded-lg border border-border/60 bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-medium">
                        {author?.full_name || "Student"}{" "}
                        <span className="text-muted-foreground">· {author?.matric_number}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{m.content}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(m.created_at)} ago
                      </p>
                    </div>
                    {m.user_id === userId && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={async () => { await supabase.from("discussion_messages").delete().eq("id", m.id); refresh(); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-border/60 px-4 py-3">
            <Textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Share your thoughts…"
              rows={2}
              className="min-h-0 resize-none"
            />
            <Button onClick={sendMsg} className="self-end"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Discussion topics</h2>
        <Button onClick={() => setCreating((c) => !c)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> New topic
        </Button>
      </div>

      {creating && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title</Label>
              <Input id="t-title" value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                placeholder="e.g. Sources of error in blood typing" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Description (optional)</Label>
              <Textarea id="t-desc" rows={2} value={newTopic.description}
                onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createTopic} size="sm">Create</Button>
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {topics.length === 0 && !creating && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No discussions yet. Start one to get the conversation going.
        </Card>
      )}

      {topics.map((t) => {
        const count = messages.filter((m) => m.topic_id === t.id).length;
        const author = t.created_by ? profiles[t.created_by] : null;
        return (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className="block w-full text-left"
          >
            <Card className="p-4 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display font-semibold">{t.title}</div>
                  {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Started by {author?.full_name || "a student"} · {formatDistanceToNow(t.created_at)} ago
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {count} {count === 1 ? "message" : "messages"}
                </Badge>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
