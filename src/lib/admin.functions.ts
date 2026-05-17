import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function verifyPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Admin password not configured");
  if (password !== expected) throw new Error("Invalid admin password");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    verifyPassword(data.password);
    return { ok: true };
  });

export const adminListNotes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    verifyPassword(data.password);
    const { data: notes, error } = await supabaseAdmin
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { notes: notes ?? [] };
  });

export const adminCreateNote = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      password: z.string(),
      title: z.string().min(1).max(200),
      topic: z.string().max(100).optional().nullable(),
      content: z.string().min(1).max(50000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    verifyPassword(data.password);
    const { data: row, error } = await supabaseAdmin
      .from("notes")
      .insert({ title: data.title, topic: data.topic ?? null, content: data.content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { note: row };
  });

export const adminUpdateNote = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      password: z.string(),
      id: z.string().uuid(),
      title: z.string().min(1).max(200),
      topic: z.string().max(100).optional().nullable(),
      content: z.string().min(1).max(50000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    verifyPassword(data.password);
    const { error } = await supabaseAdmin
      .from("notes")
      .update({
        title: data.title,
        topic: data.topic ?? null,
        content: data.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteNote = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    verifyPassword(data.password);
    const { error } = await supabaseAdmin.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminEngagement = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    verifyPassword(data.password);

    const [profilesRes, reactionsRes, commentsRes, msgsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, matric_number, email, created_at, last_seen_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("reactions").select("user_id"),
      supabaseAdmin.from("comments").select("user_id"),
      supabaseAdmin.from("discussion_messages").select("user_id"),
    ]);

    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const count = (rows: { user_id: string }[] | null, id: string) =>
      (rows ?? []).filter((r) => r.user_id === id).length;

    const students = (profilesRes.data ?? []).map((p) => ({
      ...p,
      reactions: count(reactionsRes.data, p.id),
      comments: count(commentsRes.data, p.id),
      discussions: count(msgsRes.data, p.id),
    }));

    return {
      students,
      totals: {
        students: students.length,
        reactions: reactionsRes.data?.length ?? 0,
        comments: commentsRes.data?.length ?? 0,
        discussionMessages: msgsRes.data?.length ?? 0,
      },
    };
  });
